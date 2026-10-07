# Cloudinary Free configuration

1. Create a Cloudinary Free account and open the API Keys section of its dashboard.
2. Add the following values to `backend/.env` locally or to the deployment secret store. Never use `VITE_` names and never expose them to the frontend:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_TIMEOUT_MS=30000
```

3. Restart the backend. Product images are stored below `skinora/products/<productId>`.
4. Automated tests mock Cloudinary and make no live request. Run `npm run test:product-images` in `backend`.
5. Inspect pending orphan cleanup without deleting anything: `npm run cleanup:product-images -- --dry-run`.
6. After reviewing the output, process eligible tasks with `npm run cleanup:product-images -- --execute`.

Manual smoke test: sign in as an active admin, create or edit a product, upload JPEG/PNG/WebP images, reorder them, select the primary image, replace one image and remove one image. Confirm the catalog list, product detail and admin list all display the first ordered URL.
