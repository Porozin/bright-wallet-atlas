/**
 * =========================================================================
 * GDA CAIXA 2027 — SCRIPT DE BACKUP UNIVERSAL (GOOGLE APPS SCRIPT)
 * =========================================================================
 * Este script faz 2 coisas:
 * 1. BACKUP DO SUPABASE: Recebe via Webhook (POST) os dados do novo app GDA Caixa 2027
 *    e salva automaticamente uma pasta no seu Google Drive em formato JSON.
 * 2. BACKUP DO FIRESTORE (LEGADO): Roda periodicamente por temporizador (Trigger)
 *    para puxar os dados do Firebase original se desejar.
 * =========================================================================
 */

const FOLDER_NAME = "Backups_GDA_Caixa_2027";

// --------------------------------------------------------------------------
// 1. ENDPOINT WEBHOOK (USADO PELO GDA CAIXA 2027 PWA)
// --------------------------------------------------------------------------
/**
 * Recebe o clique do botão "Backup no Google Drive" direto do aplicativo novo.
 */
function doPost(e) {
  try {
    const rawData = e.postData.contents;
    const payload = JSON.parse(rawData);
    
    // Obtém ou cria a pasta no Drive
    const folder = getOrCreateFolder(FOLDER_NAME);
    
    // Nome do arquivo com data e hora exata no fuso de Brasília
    const timestamp = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd_HH-mm-ss");
    const fileName = `backup_gdacaixa_${timestamp}.json`;
    
    // Salva o JSON formatado no Google Drive
    const file = folder.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Backup realizado com sucesso no Google Drive!",
      fileId: file.getId(),
      fileName: fileName
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("GDA Caixa 2027 Backup Webhook Ativo e Operacional!");
}


// --------------------------------------------------------------------------
// 2. ROTINA DE BACKUP FIRESTORE (SEM PRECISAR DE BIBLIOTECAS EXTERNAS)
// --------------------------------------------------------------------------
const PROJECT_ID = "guerreiros-do-alto";
const COLLECTIONS = [
  'gda_usuarios',
  'gda_metas_doceria',
  'gda_metas_vendas',
  'gda_caixa',
  'gda_unidades',
  'gda_metas_clube',
  'gda_metas_unidade',
  'gda_privado'
];

const SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "guerreiros-do-alto",
  "private_key_id": "2c5c5b9758957ce16ddba284b2c6a36846430f6f",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDRmno0WA5bm+ej\ngRMZ1w4caKeQBjJ+JCXEZHjQ26h/d1tqU0QDRNru5mJK176C8e9/fKBRv4mPHOtN\n2epjIs8Bxs9z0epSx1KxjMWzLlo4gpWbJauN34rNCSK+kwhnUTkAzJTyxPvTflxX\nltNvJvf4LA+JtCcA7oYlI48+2CPsI0/IPxgeppkpLWxKeIQI+6kiYy6kVYV8KI/R\n4rH9O3iikioo8q65GQZykOtYQobKzgM2Tty7sd5rdJWREDd/8xFw3EmbHdgPwoi8\nyrBk8JuIXlBzV4miHkxJKHva/KNAg/vPtPFumtQGsXAIEY4hBXFob+Yo6yLMXHCm\nHWXHAFrrAgMBAAECggEAFyfBqFax/1zR0jZILeqcHHdTS43jthu4MGIJFsmta6d7\n6dsZAGNy7EF3Sl1bJowjsSnLbDyErdK8C/Wu9xS5WbDk6h6ejFaIxCSREqJkRSnn\n7SPUN/AiHVSNChCkNQW8DmKLceZhC5RCD0sSQI1Fh50Welf0lx3CpAexo3etQEDT\nCct9v5fffEuwwiUFaFd0U78acKiesYVcFnfHoXpwXV1HkKaMx3aWCBlJVfBramD9\nC4V04Z+oKEGkUZ70wbFwBOPViDMkaBNQpnFUodr95Y2ixEaOEByp7ul8dtXY18F4\nYOYHMhjDDJAGAAwqhkN28NbfqNRmSMbVDRZMg6yOAQKBgQD8NLRQq79LnvusGeV9\nia+y6jTROmnaeCSeNt6ZkSm3buOEAg7J/kZo4UoDOR0wajm3lvsRzmbueMZs2kQJ\nOpI+jHx19oATvwcNBOzhQ15MHClqbbRxwwTXbQaB25MhSJdo840jPL9W9uZkb9SF\nN1K7yW81BhNP1GtuJGd5of7kYQKBgQDUwbPP03KCSicbEYlsbLzyJWPkWkEeWiX5\nG5YgA+YgiXncQPsuEGoKhSM2yaf6D84Fl+JYrcTK5QnuU60fQXtacoXtzr2RkTy7\nBQVNdnJat+REt4R11Ro7l9blViwiuZw7pr+0cutuKf3fLl4KPchOgNAFKOw45xIu\nx3Y4KuiCywKBgQDlvk0Tv6A/DtBL8jsvpKE85kS+4+tRbGhPB8S3N5k80/LFaep2\n7v7Mw41cakbAt8NkDlEf41m4mqSGvD2F+qkF+YvXGXmKg1W08mumuGvKAU1o+g6K\nIxDh/RsUaCUbCLmEjXhgRRI38inmDEkYIVFoZxK6xpIJAoPqjZcFIiDDgQKBgGr7\n2GpqHkur9AwlfmAaMczlxlxekh4sIKoqGAyTSVYVK0T5HBVmxZvypOl479HLvsKL\nRJNpFesczyibxRNRfzDVI8mYSzT2vn4goTD5nblGfS+cxKvn8+ABk1sRQPJZOVm5\nmO6pVv+3d+SRUVJ/DMmE9pWRpW9bqoYBYM4PrYmPAoGAAk/pWgPKo62eXLzEUHjb\n9fd/ltkvzCSrHpIKpUE5KhsBIGtscTd1nKj4ytBKXbz/RbJzkOZHDLQzxbYaPTca\n8kUJIe7cxH4A8V7llMVU+t/LnN4y/eCFX1IEcUFUjONR+fYR42FHfiK41SqkMR4o\nVe/jFSC0GfuqjZ51a/jcNKY=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@guerreiros-do-alto.iam.gserviceaccount.com",
  "token_uri": "https://oauth2.googleapis.com/token"
};

/**
 * Função executável manualmente ou por Temporizador (Cron/Trigger)
 */
function runFirestoreBackup() {
  const token = getFirebaseOAuthToken();
  const backupData = {
    projeto: PROJECT_ID,
    backupEm: new Date().toISOString(),
    colecoes: {}
  };
  
  COLLECTIONS.forEach(collection => {
    try {
      const data = fetchCollectionData(collection, token);
      backupData.colecoes[collection] = data;
      Logger.log(`Coleção [${collection}]: ${data.length} docs`);
    } catch (err) {
      Logger.log(`Aviso ao ler [${collection}]: ${err}`);
      backupData.colecoes[collection] = [];
    }
  });
  
  const folder = getOrCreateFolder(FOLDER_NAME);
  const timestamp = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd_HH-mm");
  const fileName = `firestore_backup_${timestamp}.json`;
  folder.createFile(fileName, JSON.stringify(backupData, null, 2));
  Logger.log(`Arquivo salvo no Drive: ${fileName}`);
}

/**
 * Gera o Token OAuth2 nativamente no Apps Script usando RSA SHA-256 (sem precisar de libs)
 */
function getFirebaseOAuthToken() {
  const header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: SERVICE_ACCOUNT.token_uri,
    exp: now + 3600,
    iat: now
  }));
  
  const toSign = header + "." + claimSet;
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, SERVICE_ACCOUNT.private_key);
  const signature = Utilities.base64EncodeWebSafe(signatureBytes);
  const jwt = toSign + "." + signature;

  const response = UrlFetchApp.fetch(SERVICE_ACCOUNT.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    payload: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const resJson = JSON.parse(response.getContentText());
  return resJson.access_token;
}

function fetchCollectionData(collection, token) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
  const options = {
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  
  if (json.documents) {
    return json.documents.map(doc => {
      const obj = { id: doc.name.split('/').pop() };
      for (let key in doc.fields) {
        const field = doc.fields[key];
        obj[key] = field[Object.keys(field)[0]];
      }
      return obj;
    });
  }
  return [];
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(name);
}
