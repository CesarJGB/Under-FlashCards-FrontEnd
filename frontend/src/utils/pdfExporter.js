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
      
      // Calcular la altura real del contenedor antes de pintar para prever saltos de página
      let blockTextHeight = (qLines.length * 6) + (aLines.length * 6) + 4;
      let blockImgHeight = card.contentImage ? 36 : 0;
      const totalBlockHeight = blockTextHeight + blockImgHeight + 8;

      if (y - 6 + totalBlockHeight > 280) { doc.addPage(); y = 22; }

      // Dibujar caja de fondo contenedor
      doc.setFillColor(250, 250, 250); doc.setDrawColor(241, 245, 249);
      doc.roundedRect(margin - 2, y - 6, contentWidth + 4, totalBlockHeight, 3, 3, "FD");

      // 1. Renderizar Pregunta
      doc.setFont("Helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
      qLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
      y += (qLines.length * 6) + 2;

      // 2. Renderizar Imagen en Pregunta (Si corresponde)
      if (card.contentImage && card.imageSide === 'question') {
        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, margin, y, 54, 32, undefined, 'FAST');
        } catch (e) { console.error(e); }
        y += 36; // El puntero baja limpiamente liberando el espacio de la foto
      }

      // 3. Renderizar Respuesta (Garantiza espacio de separación proporcional)
      doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(71, 85, 105);
      aLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
      y += (aLines.length * 6) + 2;

      // 4. Renderizar Imagen en Respuesta (Si corresponde)
      if (card.contentImage && card.imageSide === 'answer') {
        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, margin, y, 54, 32, undefined, 'FAST');
        } catch (e) { console.error(e); }
        y += 36;
      }
      
      y += 12; // Separación higiénica inter-bloques
    });

    doc.save(`${safeName}-guia.pdf`);
    return;
  }

  // =======================================================================
  // FORMATO B: TARJETAS DE RECORTAR (6 POR PÁGINA CON SEPARACIÓN DINÁMICA)
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
      if (index > 0 && pageItemIndex === 0) { doc.addPage(); }

      const col = pageItemIndex % 2;
      const row = Math.floor(pageItemIndex / 2);

      const x = marginX + col * (cardW + gapX);
      const y = marginY + row * (cardH + gapY);

      // Render de Fondos de Mazo generales
      if (card.bgImage) {
        try {
          let imgFormat = card.bgImage.includes('image/png') ? 'PNG' : card.bgImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.bgImage, imgFormat, x, y, cardW, cardH, undefined, 'FAST');
          doc.saveGraphicsState();
          doc.setGState(new doc.GState({ opacity: 0.55 }));
          doc.setFillColor(15, 23, 42); doc.rect(x, y, cardW, cardH, 'F');
          doc.restoreGraphicsState(); 
        } catch (imgErr) { doc.setFillColor(30, 41, 59); doc.rect(x, y, cardW, cardH, 'F'); }
      } else {
        doc.setFillColor(255, 255, 255);
      }

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
      // ⚖️ ALGORITMO DE FILTRADO Y DIVISOR INTERMEDIO MÓVIL
      // =======================================================================
      let dividerY = y + 38; // Por defecto corta a la mitad exacta (38mm)

      if (card.contentImage) {
        if (card.imageSide === 'question') {
          let answerAreaNeeded = 10 + (aLines.length * 4.5) + 4;
          dividerY = (y + 76) - answerAreaNeeded; // Empuja la línea abajo ganando terreno para la foto
          if (dividerY < y + 34) dividerY = y + 34; // Topes de seguridad CSS-like
          if (dividerY > y + 55) dividerY = y + 55;
        } else if (card.imageSide === 'answer') {
          let questionAreaNeeded = 10 + (qLines.length * 4.5) + 4;
          dividerY = y + questionAreaNeeded; // Empuja la línea arriba expandiendo el bloque inferior
          if (dividerY < y + 21) dividerY = y + 21;
          if (dividerY > y + 42) dividerY = y + 42;
        }
      }

      // Pintar marco contenedor de la tarjeta recortable
      doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2);
      doc.rect(x, y, cardW, cardH, card.bgImage ? 'S' : 'FD');

      // Dibujar la línea divisoria discontinua en su coordenada dinámica calibrada
      doc.setDrawColor(card.bgImage ? 100 : 210, card.bgImage ? 116 : 225, card.bgImage ? 139 : 235);
      doc.setLineDash([1, 1], 0);
      doc.line(x + 5, dividerY, x + cardW - 5, dividerY);
      doc.setLineDash([]); // Limpieza de contexto vectorial

      // =======================================================================
      // RENDEREADO DINÁMICO: SECCIÓN PREGUNTA (De "y" hasta "dividerY")
      // =======================================================================
      doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
      doc.text("PREGUNTA", textX, y + 8, { align });

      if (card.contentImage && card.imageSide === 'question') {
        let qTextBottom = y + 11 + (qLines.length * 4.5);
        let verticalGap = dividerY - qTextBottom - 2;

        // Escalado elástico: Si hay espacio vertical masivo, la imagen crece proporcionalmente
        let imgH = Math.max(14, Math.min(verticalGap, 32));
        let imgW = Math.min(imgH * 1.45, cardW - 16); // Aspect ratio 1.45 panorámico optimizado
        imgH = imgW / 1.45;

        let imgX = x + (cardW - imgW) / 2;
        let imgY = qTextBottom + (verticalGap - imgH) / 2;

        doc.setFont("Helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let currentY = y + 12.5;
        qLines.forEach((line) => {
          if (currentY < qTextBottom) { doc.text(line, textX, currentY, { align }); currentY += 4.5; }
        });
        
        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, imgX, imgY, imgW, imgH, undefined, 'FAST');
        } catch (e) { console.error(e); }
      } else {
        doc.setFont("Helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        let currentY = y + 13.5;
        qLines.slice(0, 5).forEach((line) => {
          if (currentY < dividerY - 3) { doc.text(line, textX, currentY, { align }); currentY += 4.5; }
        });
      }

      // =======================================================================
      // RENDEREADO DINÁMICO: SECCIÓN RESPUESTA (De "dividerY" hasta "y + 76")
      // =======================================================================
      doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
      doc.text("RESPUESTA", textX, dividerY + 5, { align });

      if (card.contentImage && card.imageSide === 'answer') {
        let aTextTop = dividerY + 9;
        let aTextBottom = aTextTop + (aLines.length * 4.5);
        let verticalGap = (y + 76) - aTextBottom - 3;

        let imgH = Math.max(14, Math.min(verticalGap, 32));
        let imgW = Math.min(imgH * 1.45, cardW - 16);
        imgH = imgW / 1.45;

        let imgX = x + (cardW - imgW) / 2;
        let imgY = aTextBottom + (verticalGap - imgH) / 2;

        doc.setFont("Helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(answerColor[0], answerColor[1], answerColor[2]);
        let currentY = dividerY + 9.5;
        aLines.forEach((line) => {
          if (currentY < aTextBottom) { doc.text(line, textX, currentY, { align }); currentY += 4.5; }
        });

        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, imgX, imgY, imgW, imgH, undefined, 'FAST');
        } catch (e) { console.error(e); }
      } else {
        doc.setFont("Helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(answerColor[0], answerColor[1], answerColor[2]);
        let currentY = dividerY + 10.5;
        aLines.slice(0, 5).forEach((line) => {
          if (currentY < y + 73) { doc.text(line, textX, currentY, { align }); currentY += 4.5; }
        });
      }
    });

    doc.save(`${safeName}-tarjetas.pdf`);
  }
};
