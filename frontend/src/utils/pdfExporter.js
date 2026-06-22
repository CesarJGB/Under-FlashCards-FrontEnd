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
  const safeName = (deckTitle || 'mazo').replace(/[^\w\s-]/g, '').trim();

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
      
      // 📏 Ajuste de altura estricto para evitar saltos de página huérfanos
      let imgHeight = card.contentImage ? 32 : 0;
      const blockHeight = (qLines.length * 5.5) + (aLines.length * 5.5) + 10 + imgHeight;

      if (y + blockHeight > 275) { doc.addPage(); y = 22; }

      doc.setFillColor(250, 250, 250); doc.setDrawColor(241, 245, 249);
      doc.roundedRect(margin - 2, y - 6, contentWidth + 4, blockHeight - 2, 3, 3, "FD");

      // Render Pregunta
      doc.setFont("Helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
      qLines.forEach((line, i) => { doc.text(line, margin, y + (i * 5.5)); });
      y += (qLines.length * 5.5) + 1;

      // 🖼️ Imagen en Pregunta: Eliminado espacio muerto redundante
      if (card.contentImage && card.imageSide === 'question') {
        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, margin, y + 1, 45, 28, undefined, 'FAST');
        } catch (e) { console.error(e); }
        y += 30;
      }

      // Render Respuesta
      doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(71, 85, 105);
      aLines.forEach((line, i) => { doc.text(line, margin, y + (i * 5.5)); });
      y += (aLines.length * 5.5) + 2;

      // 🖼️ Imagen en Respuesta: Ajuste milimétrico continuo
      if (card.contentImage && card.imageSide === 'answer') {
        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, margin, y + 1, 45, 28, undefined, 'FAST');
        } catch (e) { console.error(e); }
        y += 30;
      }
      
      y += 8; // Separación inter-bloques compacta
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
          let imgFormat = card.bgImage.includes('image/png') ? 'PNG' : card.bgImage.includes('image/webp') ? 'WEBP' : 'JPEG';
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

      const qMaxW = cardW - 12;
      const aMaxW = cardW - 12;

      const qLines = doc.splitTextToSize(card.question || '', qMaxW);
      const aLines = doc.splitTextToSize(card.answer || '', aMaxW);

      // =======================================================================
      // 🎴 SECCIÓN SUPERIOR: PREGUNTA
      // =======================================================================
      doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
      doc.text("PREGUNTA", textX, y + 10, { align });

      if (card.contentImage && card.imageSide === 'question') {
        // 🌟 ESCALADO INTELIGENTE: Si el texto es corto, expandimos la imagen
        const isShortText = qLines.length <= 1;
        const imgW = isShortText ? 34 : 24;
        const imgH = isShortText ? 19 : 13;
        const imgX = x + (cardW - imgW) / 2;

        doc.setFont("Helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        
        // Renderizar el texto disponible arriba
        let currentY = isShortText ? y + 14.5 : y + 14;
        qLines.slice(0, isShortText ? 1 : 2).forEach((line) => {
          doc.text(line, textX, currentY, { align });
          currentY += 4.5;
        });
        
        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          // Se posiciona al centro de forma dinámica sin colisionar
          doc.addImage(card.contentImage, imgFormat, imgX, isShortText ? y + 17.5 : y + 23, imgW, imgH, undefined, 'FAST');
        } catch (e) { console.error(e); }
      } else {
        // Flujo regular sin imagen adjunta (soporta hasta 4 líneas de texto)
        doc.setFont("Helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let currentY = y + 16.5;
        qLines.slice(0, 4).forEach((line) => {
          doc.text(line, textX, currentY, { align });
          currentY += 4.5;
        });
      }

      // Línea divisora central fija
      doc.setDrawColor(card.bgImage ? 71 : 226, card.bgImage ? 85 : 232, card.bgImage ? 105 : 240);
      doc.line(x + 6, y + 38, x + cardW - 6, y + 38);

      // =======================================================================
      // 🎴 SECCIÓN INFERIOR: RESPUESTA
      // =======================================================================
      doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
      doc.text("RESPUESTA", textX, y + 44, { align });

      if (card.contentImage && card.imageSide === 'answer') {
        // 🌟 ESCALADO INTELIGENTE: Adaptación proporcional para la respuesta
        const isShortText = aLines.length <= 1;
        const imgW = isShortText ? 34 : 24;
        const imgH = isShortText ? 19 : 13;
        const imgX = x + (cardW - imgW) / 2;

        doc.setFont("Helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(answerColor[0], answerColor[1], answerColor[2]);
        
        let currentY = isShortText ? y + 48.5 : y + 48;
        aLines.slice(0, isShortText ? 1 : 2).forEach((line) => {
          doc.text(line, textX, currentY, { align });
          currentY += 4.5;
        });

        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, imgX, isShortText ? y + 51.5 : y + 57, imgW, imgH, undefined, 'FAST');
        } catch (e) { console.error(e); }
      } else {
        // Flujo regular sin imagen adjunta
        doc.setFont("Helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(answerColor[0], answerColor[1], answerColor[2]);
        let currentY = y + 50.5;
        aLines.slice(0, 4).forEach((line) => {
          doc.text(line, textX, currentY, { align });
          currentY += 4.5;
        });
      }
    });

    doc.save(`${safeName}-tarjetas.pdf`);
  }
};
