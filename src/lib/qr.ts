/** Gera o QR code como imagem (PNG em data URL). A biblioteca só é baixada na primeira vez que um QR aparece. */
export async function qrDataUrl(text: string, width: number) {
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(text, { margin: 1, width, color: { dark: '#1c1c1e', light: '#ffffff' } })
}
