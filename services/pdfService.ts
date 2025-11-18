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
  },

  async extractPages(pdfBuffer: ArrayBuffer, pageIndices: number[]): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const newPdf = await PDFDocument.create();
    
    // Validate indices against document length to prevent errors
    const pageCount = pdfDoc.getPageCount();
    const validIndices = pageIndices.filter(i => i >= 0 && i < pageCount);

    if (validIndices.length === 0) {
      throw new Error(`Invalid page range. Document only has ${pageCount} pages.`);
    }

    const copiedPages = await newPdf.copyPages(pdfDoc, validIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    return await newPdf.save();
  }
};