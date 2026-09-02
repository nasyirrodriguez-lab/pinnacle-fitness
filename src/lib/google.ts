import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
const CREDS = {
  type: 'service_account',
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY,
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.GOOGLE_CERT_URL,
  universe_domain: 'googleapis.com',
}

export async function getNumRows() {
  const auth = new google.auth.JWT(
    CREDS.client_email,
    undefined,
    CREDS.private_key,
    SCOPES,
    undefined,
    CREDS.private_key_id
  )

  const service = google.sheets({ version: 'v4', auth })
  const result = await service.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: 'A1:C100000',
  })

  return result.data.values ? result.data.values.length : 0
}

export async function addRow(
  firstName: string,
  lastName: string,
  email: string,
  tel: string,
  age: string,
  membership: string
) {
  const auth = new google.auth.JWT(
    CREDS.client_email,
    undefined,
    CREDS.private_key,
    SCOPES,
    undefined,
    CREDS.private_key_id
  )
  const service = google.sheets({ version: 'v4', auth })
  const numRows = await getNumRows()
  const nextRow = numRows + 1

  await service.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: `Sheet1!A${nextRow}:C${nextRow}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[firstName, lastName, email, tel, age, membership]],
    },
  })
}
