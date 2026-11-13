import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../api/axiosClient", () => ({ default: api }));

import ProductForm from "../pages/admin/ProductForm";

const product = { _id: "product-1", __v: 3, name: "Serum", slug: "serum", brand: "Skinora", category: { _id: "cat-1" }, description: "", basePrice: 100000, salePrice: null };
const uploadResult = { data: { data: { version: 4, images: [{ imageKey: "cloud-1", url: "https://res.cloudinary.com/demo/first.webp", isPrimary: true, managed: true }] } } };

function renderForm(path = "/admin/products/new") {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/products/new" element={<ProductForm />} /><Route path="/admin/products/:id/edit" element={<ProductForm />} /><Route path="/admin/products" element={<div>Product list</div>} /></Routes></MemoryRouter>);
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText("Tên sản phẩm"), "Serum");
  await userEvent.type(screen.getByLabelText("Slug"), "serum");
  await userEvent.type(screen.getByLabelText("Thương hiệu"), "Skinora");
  await userEvent.selectOptions(screen.getByLabelText("Danh mục"), "cat-1");
}

async function confirmSave() {
  await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
  await userEvent.click(screen.getByRole("button", { name: /Xác nhận (tạo sản phẩm|lưu)/ }));
}

function chooseImages(container, names = ["first.png", "second.png"]) {
  const files = names.map(name => new File([name], name, { type: "image/png" }));
  fireEvent.change(container.querySelector('input[type="file"][multiple]'), { target: { files } });
  return files;
}

describe("product image auto-upload", () => {
  beforeEach(() => {
    // Clear one-time response queues too, so a failed test cannot affect the next test.
    vi.resetAllMocks();
    api.get.mockImplementation(url => url === "/categories"
      ? Promise.resolve({ data: { data: { categories: [{ _id: "cat-1", name: "Serum" }] } } })
      : url === "/admin/brands"
        ? Promise.resolve({ data: { data: { brands: [{ _id: "brand-1", name: "Skinora" }] } } })
        : Promise.resolve({ data: { data: { product } } }));
    api.post.mockImplementation(url => url === "/products"
      ? Promise.resolve({ data: { data: { product } } })
      : Promise.resolve(uploadResult));
    globalThis.URL.createObjectURL = vi.fn(file => `blob:${file.name}`);
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("places the product save action after SKU editors and links it to the main form", () => {
    const { container } = renderForm("/admin/products/product-1/edit");
    const variantSection = container.querySelector(".variant-admin");
    const bottomActions = container.querySelector(".admin-product-save-actions");
    const saveButton = screen.getByRole("button", { name: "Lưu sản phẩm" });
    expect(variantSection.nextElementSibling).toBe(bottomActions);
    expect(saveButton).toHaveAttribute("form", "skinora-product-editor");
    expect(saveButton.form).toBe(container.querySelector("form#skinora-product-editor"));
  });

  it("asks for confirmation and does not create a product if cancelled", async () => {
    renderForm();
    await fillRequiredFields();
    await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Bạn chắc chắn muốn tạo sản phẩm?");
    expect(api.post).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("asks for confirmation before changing an existing product", async () => {
    api.get.mockImplementation(url => url === "/categories"
      ? Promise.resolve({ data: { data: { categories: [{ _id: "cat-1", name: "Serum" }] } } })
      : url === "/admin/products/product-1"
        ? Promise.resolve({ data: { data: { product, variants: [] } } })
        : Promise.resolve({ data: { data: { images: [], version: 3 } } }));
    api.put.mockResolvedValueOnce({ data: { success: true } });
    renderForm("/admin/products/product-1/edit");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Tên sản phẩm" })).toHaveValue("Serum"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Bạn chắc chắn muốn lưu thay đổi?");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận lưu" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
  });

  it("creates the product once, then uploads pending images in selection order", async () => {
    const { container } = renderForm();
    await fillRequiredFields();
    const files = chooseImages(container);
    expect(screen.getAllByText("Chờ tải lên")).toHaveLength(2);

    await confirmSave();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[0][0]).toBe("/products");
    expect(api.post.mock.calls[1][0]).toBe("/products/product-1/images");
    const body = api.post.mock.calls[1][1];
    expect(body.getAll("images")).toEqual(files);
    expect(body.get("expectedVersion")).toBe("3");
    expect(uploadResult.data.data.images[0].isPrimary).toBe(true);
  });

  it("keeps the created product and retries only the failed image upload", async () => {
    api.post.mockImplementationOnce(() => Promise.resolve({ data: { data: { product } } }))
      .mockRejectedValueOnce({ response: { status: 503, data: { message: "Cloud unavailable" } } })
      .mockResolvedValueOnce(uploadResult);
    const { container } = renderForm();
    await fillRequiredFields();
    chooseImages(container, ["retry.png"]);

    await confirmSave();
    // The page intentionally shows the same error near the form and the bottom action.
    const retry = await screen.findByRole("button", { name: "Thử tải ảnh lại" });
    expect(screen.getAllByText("Sản phẩm đã được tạo nhưng một số ảnh tải lên thất bại").length).toBeGreaterThan(0);
    await userEvent.click(retry);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
    expect(api.post.mock.calls.filter(([url]) => url === "/products")).toHaveLength(1);
    expect(api.post.mock.calls.filter(([url]) => url === "/products/product-1/images")).toHaveLength(2);
  });

  it("prevents double submit from creating or uploading twice", async () => {
    let finishCreate;
    api.post.mockImplementationOnce(() => new Promise(resolve => { finishCreate = resolve; })).mockResolvedValueOnce(uploadResult);
    const { container } = renderForm();
    await fillRequiredFields();
    chooseImages(container, ["only.png"]);
    const save = screen.getByRole("button", { name: "Lưu sản phẩm" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(api.post.mock.calls.filter(([url]) => url === "/products")).toHaveLength(0);
    const confirm = screen.getByRole("button", { name: "Xác nhận tạo sản phẩm" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.post.mock.calls.filter(([url]) => url === "/products")).toHaveLength(1);
    expect(confirm).toBeDisabled();
    await waitFor(() => expect(finishCreate).toEqual(expect.any(Function)));
    finishCreate({ data: { data: { product } } });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  });

  it("auto-uploads newly selected images while editing with the current version", async () => {
    api.get.mockImplementation(url => {
      if (url === "/categories") return Promise.resolve({ data: { data: { categories: [] } } });
      if (url === "/products/product-1") return Promise.resolve({ data: { data: { product } } });
      return Promise.resolve({ data: { data: { images: [], version: 3 } } });
    });
    const { container } = renderForm("/admin/products/product-1/edit");
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/products/product-1/images", { sessionProtected: true }));
    chooseImages(container, ["edit.png"]);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/products/product-1/images", expect.any(FormData), expect.any(Object)));
    const body = api.post.mock.calls.find(([url]) => url.endsWith("/images"))[1];
    expect(body.get("expectedVersion")).toBe("3");
  });

  it("disables the product save action while an edit image upload is running", async () => {
    let finishUpload;
    api.get.mockImplementation(url => {
      if (url === "/categories") return Promise.resolve({ data: { data: { categories: [] } } });
      if (url === "/products/product-1") return Promise.resolve({ data: { data: { product } } });
      return Promise.resolve({ data: { data: { images: [], version: 3 } } });
    });
    api.post.mockImplementation(() => new Promise(resolve => { finishUpload = resolve; }));
    const { container } = renderForm("/admin/products/product-1/edit");
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/products/product-1/images", { sessionProtected: true }));
    chooseImages(container, ["edit-busy.png"]);
    // Disabled can have other causes, so first confirm the upload was started.
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/products/product-1/images", expect.any(FormData), expect.any(Object)));
    expect(screen.getByRole("button", { name: "Lưu sản phẩm" })).toBeDisabled();
    expect(finishUpload).toEqual(expect.any(Function));
    finishUpload(uploadResult);
    await waitFor(() => expect(screen.getByRole("button", { name: "Lưu sản phẩm" })).toBeEnabled());
  });

  it("revokes local object URLs after a successful upload", async () => {
    const { container } = renderForm();
    await fillRequiredFields();
    chooseImages(container, ["cleanup.png"]);
    await confirmSave();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cleanup.png"));
  });

  it("saves product edits even when the new-variant inputs are blank", async () => {
    api.get.mockImplementation(url => {
      if (url === "/categories") return Promise.resolve({ data: { data: { categories: [{ _id: "cat-1", name: "Serum" }] } } });
      if (url === "/admin/brands") return Promise.resolve({ data: { data: { brands: [] } } });
      if (url === "/admin/products/product-1") return Promise.resolve({ data: { data: { product: { ...product, isActive: true }, variants: [] } } });
      return Promise.resolve({ data: { data: { images: [], version: 3 } } });
    });
    api.put.mockResolvedValueOnce({ data: { success: true } });
    renderForm("/admin/products/product-1/edit");
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Tên sản phẩm" })).toHaveValue("Serum"));
    expect(screen.getByLabelText("Mới tên phiên bản")).not.toBeRequired();
    expect(screen.getByLabelText("Mới SKU")).not.toBeRequired();
    await confirmSave();
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/products/product-1", expect.objectContaining({ name: "Serum" }), { sessionProtected: true }));
  });

  it("sends size, unit, sale price and stock for a new variant", async () => {
    api.get.mockImplementation(url => {
      if (url === "/categories") return Promise.resolve({ data: { data: { categories: [] } } });
      if (url === "/admin/products/product-1") return Promise.resolve({ data: { data: { product, variants: [] } } });
      return Promise.resolve({ data: { data: { images: [], version: 3 } } });
    });
    api.post.mockResolvedValueOnce({ data: { data: { variant: { _id: "variant-1", name: "Chai 100 ml", sku: "SERUM-100", size: "100", unit: "ml", price: 100000, salePrice: 90000, stock: 5, isActive: true } } } });
    renderForm("/admin/products/product-1/edit");
    await userEvent.type(await screen.findByLabelText("Mới tên phiên bản"), "Chai 100 ml");
    await userEvent.type(screen.getByLabelText("Mới SKU"), "SERUM-100");
    await userEvent.type(screen.getByLabelText("Mới dung tích"), "100");
    await userEvent.clear(screen.getByLabelText("Mới giá giảm"));
    await userEvent.type(screen.getByLabelText("Mới giá giảm"), "90000");
    await userEvent.clear(screen.getByLabelText("Mới tồn kho"));
    await userEvent.type(screen.getByLabelText("Mới tồn kho"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Thêm phiên bản" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/products/product-1/variants", expect.objectContaining({ size: "100", unit: "ml", salePrice: 90000, stock: 5 }), { sessionProtected: true }));
  });

  const skuVariant = { _id: "variant-100", name: "100ml", sku: "SKU-100", size: "100", unit: "ml", price: 300000, salePrice: null, stock: 0, isActive: true };
  function mockSkuEdit() {
    api.get.mockImplementation(url => {
      if (url === "/categories") return Promise.resolve({ data: { data: { categories: [{ _id: "cat-1", name: "Serum" }] } } });
      if (url === "/admin/brands") return Promise.resolve({ data: { data: { brands: [{ _id: "brand-1", name: "Skinora" }] } } });
      if (url === "/admin/products/product-1") return Promise.resolve({ data: { data: { product: { ...product, isActive: false }, variants: [skuVariant] } } });
      return Promise.resolve({ data: { data: { images: [], version: 3 } } });
    });
  }

  it("saves edited SKU stock before saving the product with one bottom confirmation", async () => {
    mockSkuEdit();
    api.put.mockImplementation((url, data) => url.startsWith("/variants/")
      ? Promise.resolve({ data: { data: { variant: { ...skuVariant, ...data } } } })
      : Promise.resolve({ data: { success: true } }));
    renderForm("/admin/products/product-1/edit");
    const stock = await screen.findByLabelText("SKU-100 tồn kho");
    fireEvent.change(stock, { target: { value: "5" } });
    expect(screen.getByText(/Chưa lưu/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("1 SKU đã sửa");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận lưu" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(api.put.mock.calls[0][0]).toBe("/variants/variant-100");
    expect(api.put.mock.calls[0][1].stock).toBe(5);
    expect(api.put.mock.calls[1][0]).toBe("/products/product-1");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("stops product save when saving a dirty SKU fails and allows retry", async () => {
    mockSkuEdit();
    api.put.mockRejectedValueOnce({ response: { status: 503, data: { message: "SKU tạm không lưu được" } } })
      .mockResolvedValueOnce({ data: { data: { variant: { ...skuVariant, stock: 2 } } } })
      .mockResolvedValueOnce({ data: { success: true } });
    renderForm("/admin/products/product-1/edit");
    fireEvent.change(await screen.findByLabelText("SKU-100 tồn kho"), { target: { value: "2" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận lưu" }));
    // Error is repeated near the form and save area; assert inside the confirm dialog.
    expect(await within(screen.getByRole("dialog")).findByText(/SKU tạm không lưu được/)).toBeInTheDocument();
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put.mock.calls[0][0]).toBe("/variants/variant-100");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận lưu" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(3));
    expect(api.put.mock.calls[2][0]).toBe("/products/product-1");
  });

  it("does not save the same SKU twice when its individual save already succeeded", async () => {
    mockSkuEdit();
    api.put.mockImplementation((url, data) => url.startsWith("/variants/")
      ? Promise.resolve({ data: { data: { variant: { ...skuVariant, ...data } } } })
      : Promise.resolve({ data: { success: true } }));
    renderForm("/admin/products/product-1/edit");
    fireEvent.change(await screen.findByLabelText("SKU-100 tồn kho"), { target: { value: "4" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu phiên bản" }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Chưa lưu/)).not.toBeInTheDocument();
    await confirmSave();
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
    expect(api.put.mock.calls[1][0]).toBe("/products/product-1");
  });

  it("warns about an uncreated draft SKU instead of silently discarding it", async () => {
    api.get.mockImplementation(url => {
      if (url === "/categories") return Promise.resolve({ data: { data: { categories: [{ _id: "cat-1", name: "Serum" }] } } });
      if (url === "/admin/brands") return Promise.resolve({ data: { data: { brands: [] } } });
      if (url === "/admin/products/product-1") return Promise.resolve({ data: { data: { product, variants: [] } } });
      return Promise.resolve({ data: { data: { images: [], version: 3 } } });
    });
    renderForm("/admin/products/product-1/edit");
    const draftName = await screen.findByLabelText("Mới tên phiên bản");
    fireEvent.change(draftName, { target: { value: "Chai 30ml" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
    expect(screen.getByRole("alert")).toHaveTextContent("chưa bấm");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

});
