import { PDFDocument, degrees } from 'pdf-lib';

export const pdfService = {
  async mergePdfs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
    const mergedPdf = await PDFDocument.create();

    for (const buffer of pdfBuffers) {
      const pdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    return await mergedPdf.save();
  },

  async rotatePdf(pdfBuffer: ArrayBuffer, rotationDegrees: number): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    
    pages.forEach((page) => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + rotationDegrees));
    });

    return await pdfDoc.save();
  }
};