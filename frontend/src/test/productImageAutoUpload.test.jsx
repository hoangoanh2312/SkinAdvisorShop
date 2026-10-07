import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function chooseImages(container, names = ["first.png", "second.png"]) {
  const files = names.map(name => new File([name], name, { type: "image/png" }));
  fireEvent.change(container.querySelector('input[type="file"][multiple]'), { target: { files } });
  return files;
}

describe("product image auto-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(url => url === "/categories"
      ? Promise.resolve({ data: { data: { categories: [{ _id: "cat-1", name: "Serum" }] } } })
      : Promise.resolve({ data: { data: { product } } }));
    api.post.mockImplementation(url => url === "/products"
      ? Promise.resolve({ data: { data: { product } } })
      : Promise.resolve(uploadResult));
    globalThis.URL.createObjectURL = vi.fn(file => `blob:${file.name}`);
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("creates the product once, then uploads pending images in selection order", async () => {
    const { container } = renderForm();
    await fillRequiredFields();
    const files = chooseImages(container);
    expect(screen.getAllByText("Chờ tải lên")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
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

    await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
    expect(await screen.findByText("Sản phẩm đã được tạo nhưng một số ảnh tải lên thất bại")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thử tải ảnh lại" }));
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
    expect(api.post.mock.calls.filter(([url]) => url === "/products")).toHaveLength(1);
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
    await waitFor(() => expect(screen.getByRole("button", { name: "Lưu sản phẩm" })).toBeDisabled());
    finishUpload(uploadResult);
    await waitFor(() => expect(screen.getByRole("button", { name: "Lưu sản phẩm" })).toBeEnabled());
  });

  it("revokes local object URLs after a successful upload", async () => {
    const { container } = renderForm();
    await fillRequiredFields();
    chooseImages(container, ["cleanup.png"]);
    await userEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm" }));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cleanup.png"));
  });
});
