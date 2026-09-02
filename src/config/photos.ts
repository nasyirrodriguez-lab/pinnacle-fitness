// Private Supabase Storage bucket for visitor + member faces. Files are
// served via short-lived signed URLs from admin views; never exposed
// publicly.

export const VISITOR_PHOTOS_BUCKET = 'visitor-photos'

// Generous cap — selfies are downscaled client-side to ~720px / JPEG-q70,
// which lands well under 500 KB. The cap is a safety belt against
// pathological camera output, not the target.
export const VISITOR_PHOTO_MAX_BYTES = 2 * 1024 * 1024

export const VISITOR_PHOTO_MIME = 'image/jpeg'
