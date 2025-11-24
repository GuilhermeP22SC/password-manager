// Funções sem criptografia, apenas serialização/deserialização
export async function encryptData(data) {
  return JSON.stringify(data);
}

export async function decryptData(dataString) {
  try {
    return JSON.parse(dataString);
  } catch (e) {
    console.error("Erro ao ler dados do cofre", e);
    throw new Error("Dados corrompidos.");
  }
}
