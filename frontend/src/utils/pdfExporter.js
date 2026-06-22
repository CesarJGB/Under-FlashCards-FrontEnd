// ARCHIVO: frontend/src/utils/pdfExporter.js
import { jsPDF } from 'jspdf';

/**
 * Genera y descarga un documento PDF basado en las tarjetas de un mazo.
 * @param {string} deckTitle - Título del mazo de flashcards.
 * @param {Array} cards - Colección de tarjetas a procesar.
 * @param {string} type - Tipo de exportación ('guide' o 'cards').
 */
export const exportDeckToPDF = (deckTitle, cards, type = 'guide') => {
  if (!cards || cards.length === 0) return;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const safeName = (deckTitle || 'guia-estudio').replace(/[^\w\s-]/g, '').trim();

  // =======================================================================
  // FORMATO A: GUÍA DE ESTUDIO (LISTADO VERTICAL CONTINUO)
  // =======================================================================
  if (type === 'guide') {
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    doc.setFont("Helvetica", "bold"); doc.setFontSize(22);
    doc.text(`Guía de Estudio: ${deckTitle}`, margin, 22);
    doc.setFont("Helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
    doc.text(`Total de tarjetas: ${cards.length} | Generado el ${new Date().toLocaleDateString()}`, margin, 29);

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(margin, 32, pageWidth - margin, 32);

    let y = 42;
    cards.forEach((card) => {
      const qLines = doc.splitTextToSize(`P: ${card.question}`, contentWidth);
      const aLines = doc.splitTextToSize(`R: ${card.answer}`, contentWidth);
      
      let imgHeight = card.contentImage ? 34 : 0;
      const blockHeight = (qLines.length * 6) + (aLines.length * 6) + 14 + imgHeight;

      if (y + blockHeight > 275) { doc.addPage(); y = 22; }

      doc.setFillColor(250, 250, 250); doc.setDrawColor(241, 245, 249);
      doc.roundedRect(margin - 2, y - 6, contentWidth + 4, blockHeight - 4, 3, 3, "FD");

      doc.setFont("Helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
      qLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
      y += (qLines.length * 6) + 3;

      if (card.contentImage && card.imageSide === 'question') {
        try {
          let imgFormat = 'JPEG';
          if (card.contentImage.includes('image/png')) imgFormat = 'PNG';
          if (card.contentImage.includes('image/webp')) imgFormat = 'WEBP';
          doc.addImage(card.contentImage, imgFormat, margin, y, 45, 30, undefined, 'FAST');
        } catch (e) { console.error(e); }
        y += 32;
      }

      doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(71, 85, 105);
      aLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
      y += (aLines.length * 6) + 4;

      if (card.contentImage && card.imageSide === 'answer') {
        try {
          let imgFormat = 'JPEG';
          if (card.contentImage.includes('image/png')) imgFormat = 'PNG';
          if (card.contentImage.includes('image/webp')) imgFormat = 'WEBP';
          doc.addImage(card.contentImage, imgFormat, margin, y, 45, 30, undefined, 'FAST');
        } catch (e) { console.error(e); }
        y += 32;
      }
      
      y += 8; 
    });

    doc.save(`${safeName}-guia.pdf`);
    return;
  }

  // =======================================================================
  // FORMATO B: TARJETAS DE RECORTAR (6 POR PÁGINA)
  // =======================================================================
  if (type === 'cards') {
    const marginX = 12;
    const marginY = 15;
    const cardW = 88;  
    const cardH = 76;  
    const gapX = 10;
    const gapY = 10;

    cards.forEach((card, index) => {
      const pageItemIndex = index % 6;
      if (index > 0 && pageItemIndex === 0) {
        doc.addPage();
      }

      const col = pageItemIndex % 2;
      const row = Math.floor(pageItemIndex / 2);

      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);

      if (card.bgImage) {
        try {
          let imgFormat = 'JPEG';
          if (card.bgImage.includes('image/png')) imgFormat = 'PNG';
          if (card.bgImage.includes('image/webp')) imgFormat = 'WEBP';
          
          doc.addImage(card.bgImage, imgFormat, x, y, cardW, cardH, undefined, 'FAST');
          doc.saveGraphicsState();
          doc.setGState(new doc.GState({ opacity: 0.55 }));
          doc.setFillColor(15, 23, 42); 
          doc.rect(x, y, cardW, cardH, 'F');
          doc.restoreGraphicsState(); 
        } catch (imgErr) {
          doc.setFillColor(30, 41, 59);
          doc.rect(x, y, cardW, cardH, 'F');
        }
      } else {
        doc.setFillColor(255, 255, 255);
      }

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(x, y, cardW, cardH, card.bgImage ? 'S' : 'FD');

      const align = ['left', 'center', 'right'].includes(card.textAlign) ? card.textAlign : 'center';
      let textX = x + 6;
      if (align === 'center') textX = x + (cardW / 2);
      if (align === 'right') textX = x + cardW - 6;

      const textColor = card.bgImage ? [255, 255, 255] : [15, 23, 42];
      const subColor = card.bgImage ? [148, 163, 184] : [100, 116, 139];
      const answerColor = card.bgImage ? [241, 245, 249] : [51, 65, 85];

      const imgW = 26;
      const imgH = 17;
      const imgX = x + (cardW - imgW) / 2;

      const qMaxW = cardW - 12;
      const aMaxW = cardW - 12;

      const qLines = doc.splitTextToSize(card.question || '', qMaxW);
      const aLines = doc.splitTextToSize(card.answer || '', aMaxW);

      // --- Pregunta ---
      doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
      doc.text("PREGUNTA", textX, y + 11, { align });

      if (card.contentImage && card.imageSide === 'question') {
        doc.setFont("Helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let currentY = y + 15.5;
        qLines.slice(0, 1).forEach((line) => {
          doc.text(line, textX, currentY, { align });
        });
        
        try {
          let imgFormat = 'JPEG';
          if (card.contentImage.includes('image/png')) imgFormat = 'PNG';
          if (card.contentImage.includes('image/webp')) imgFormat = 'WEBP';
          doc.addImage(card.contentImage, imgFormat, imgX, y + 19, imgW, imgH, undefined, 'FAST');
        } catch (e) { console.error(e); }
      } else {
        doc.setFont("Helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let currentY = y + 17;
        qLines.slice(0, 4).forEach((line) => {
          doc.text(line, textX, currentY, { align });
          currentY += 4.5;
        });
      }

      // Separador
      doc.setDrawColor(card.bgImage ? 71 : 226, card.bgImage ? 85 : 232, card.bgImage ? 105 : 240);
      doc.line(x + 6, y + 38, x + cardW - 6, y + 38);

      // --- Respuesta ---
      doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
      doc.text("RESPUESTA", textX, y + 45, { align });

      if (card.contentImage && card.imageSide === 'answer') {
        doc.setFont("Helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(answerColor[0], answerColor[1], answerColor[2]);
        let currentY = y + 49.5;
        aLines.slice(0, 1).forEach((line) => {
          doc.text(line, textX, currentY, { align });
        });

        try {
          let imgFormat = 'JPEG';
          if (card.contentImage.includes('image/png')) imgFormat = 'PNG';
          if (card.contentImage.includes('image/webp')) imgFormat = 'WEBP';
          doc.addImage(card.contentImage, imgFormat, imgX, y + 53, imgW, imgH, undefined, 'FAST');
        } catch (e) { console.error(e); }
      } else {
        doc.setFont("Helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(answerColor[0], answerColor[1], answerColor[2]);
        let currentY = y + 51;
        aLines.slice(0, 4).forEach((line) => {
          doc.text(line, textX, currentY, { align });
          currentY += 4.5;
        });
      }
    });

    doc.save(`${safeName}-tarjetas.pdf`);
  }
};
