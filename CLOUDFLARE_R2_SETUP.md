# TripMate — Cloudflare R2 Setup

TripMate stores new trip documents and profile photos in one private Cloudflare R2 bucket. TiDB stores only the `r2://bucket/object-key` reference and the existing file metadata.

## 1. Create the bucket

1. In Cloudflare, open **R2 Object Storage**.
2. Create a bucket named `tripmate-files` (or another name you prefer).
3. Keep public access disabled. TripMate authorizes access before proxying a document or creating a short-lived signed URL.

## 2. Create R2 API credentials

Create an R2 API token with **Object Read & Write** permission limited to the TripMate bucket. Copy these values when Cloudflare shows them:

- Access Key ID
- Secret Access Key
- S3 API endpoint, normally `https://<account-id>.r2.cloudflarestorage.com`

Never commit these values to GitHub.

## 3. Configure the backend

For local development, copy `backend/.env.example` to `backend/.env` and set:

```env
R2_ENABLED=true
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access-key-id>
R2_SECRET_ACCESS_KEY=<secret-access-key>
R2_BUCKET=tripmate-files
R2_PRESIGNED_URL_EXPIRATION=3600
```

For Render, enter the four secret values requested by the Blueprint:

```text
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
```

`R2_ENABLED=true` and a one-hour signed-URL expiry are already configured in `render.yaml`.

## 4. Optional browser CORS for signed document URLs

The existing `/content` endpoint proxies document bytes through Spring Boot and does not require R2 CORS. The new `/download-url` endpoint returns a direct signed R2 URL. If the Angular app fetches that URL with `HttpClient`, add this R2 bucket CORS policy and replace the origin if Render assigns a different frontend URL:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:4200",
      "https://tripmate-web-thiru-murugan3.onrender.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 5. Object layout

```text
tripmate-files
├── users/{userId}/profile/{uuid}.{extension}
└── trips/{tripId}/documents/{uuid}.{extension}
```

The bucket remains private. The database never stores access keys or file bytes.

## 6. API behavior

- Existing document upload, content, and delete APIs keep their current paths.
- `GET /api/v1/trips/{tripId}/documents/{documentId}/download-url` creates an authorized, temporary R2 URL.
- Profile responses contain a temporary signed photo URL when the profile image is stored in R2.
- Existing local `/uploads/...` database references remain supported for local development.

## 7. Verify

1. Start the backend with the R2 variables set.
2. Upload a profile photo and confirm an object appears under `users/{userId}/profile/`.
3. Upload a trip document and confirm it appears under `trips/{tripId}/documents/`.
4. Open the document through the existing content endpoint.
5. Request the new download URL and verify it expires after the configured time.
6. Delete the profile photo and document, then confirm their R2 objects are removed.

Old files from Render's former ephemeral `uploads/` directory cannot be recovered after Render has already removed them. Only new uploads are guaranteed to be durable after R2 is enabled.
