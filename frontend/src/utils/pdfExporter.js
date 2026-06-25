// FILE: frontend/src/utils/pdfExporter.js
import { jsPDF } from 'jspdf';

// Importamos la función de parseo unificada y centralizada
import { parseCardStyles } from '../lib/utils';

// 🧠 AYUDANTE: Convierte colores HEX a RGB puro para garantizar compatibilidad con jsPDF
const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16),
      g: parseInt(cleanHex[1] + cleanHex[1], 16),
      b: parseInt(cleanHex[2] + cleanHex[2], 16)
    };
  }
  if (cleanHex.length === 6) {
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16)
    };
  }
  return null;
};

// El bloque redundante local "parseCardStyles" fue removido con éxito.

/**
 * Genera y descarga un documento PDF basado en las tarjetas de un mazo con soporte de color.
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
      
      let blockTextHeight = (qLines.length * 6) + (aLines.length * 6) + 4;
      let blockImgHeight = card.contentImage ? 36 : 0;
      const totalBlockHeight = blockTextHeight + blockImgHeight + 8;

      if (y - 6 + totalBlockHeight > 280) { doc.addPage(); y = 22; }

      // Consumimos la utilidad global centralizada
      const st = parseCardStyles(card.fontSize);
      const bgRgb = hexToRgb(st.bgColor);

      let isDarkBg = false;
      if (bgRgb) {
        const luma = 0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b;
        isDarkBg = luma < 140;
      }

      if (bgRgb) {
        doc.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
      } else {
        doc.setFillColor(250, 250, 250);
      }
      doc.setDrawColor(241, 245, 249);
      doc.roundedRect(margin - 2, y - 6, contentWidth + 4, totalBlockHeight, 3, 3, "FD");

      // 1. Renderizar Pregunta
      doc.setFont("Helvetica", "bold"); doc.setFontSize(11);
      const finalQColor = hexToRgb(st.qColor) || (isDarkBg ? { r: 255, g: 255, b: 255 } : { r: 15, g: 23, b: 42 });
      doc.setTextColor(finalQColor.r, finalQColor.g, finalQColor.b);
      
      qLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
      y += (qLines.length * 6) + 2;

      // 2. Renderizar Imagen en Pregunta
      if (card.contentImage && card.imageSide === 'question') {
        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, margin, y, 54, 32, undefined, 'FAST');
        } catch (e) { console.error(e); }
        y += 36;
      }

      // 3. Renderizar Respuesta
      doc.setFont("Helvetica", "normal"); doc.setFontSize(11);
      const finalAColor = hexToRgb(st.aColor) || (isDarkBg ? { r: 241, g: 245, b: 249 } : { r: 71, g: 85, b: 105 });
      doc.setTextColor(finalAColor.r, finalAColor.g, finalAColor.b);
      
      aLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
      y += (aLines.length * 6) + 2;

      // 4. Renderizar Imagen en Respuesta
      if (card.contentImage && card.imageSide === 'answer') {
        try {
          let imgFormat = card.contentImage.includes('image/png') ? 'PNG' : card.contentImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.contentImage, imgFormat, margin, y, 54, 32, undefined, 'FAST');
        } catch (e) { console.error(e); }
        y += 36;
      }
      
      y += 12;
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

      // Consumimos la utilidad global centralizada
      const st = parseCardStyles(card.fontSize);
      const bgRgb = hexToRgb(st.bgColor);

      // RENDER DE FONDOS: Da prioridad a la imagen de mazo y usa el color sólido como base
      if (card.bgImage) {
        try {
          let imgFormat = card.bgImage.includes('image/png') ? 'PNG' : card.bgImage.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(card.bgImage, imgFormat, x, y, cardW, cardH, undefined, 'FAST');
          doc.saveGraphicsState();
          doc.setGState(new doc.GState({ opacity: 0.55 }));
          doc.setFillColor(15, 23, 42); doc.rect(x, y, cardW, cardH, 'F');
          doc.restoreGraphicsState(); 
        } catch (imgErr) { 
          if (bgRgb) doc.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b);
          else doc.setFillColor(30, 41, 59); 
          doc.rect(x, y, cardW, cardH, 'F'); 
        }
      } else if (bgRgb) {
        doc.setFillColor(bgRgb.r, bgRgb.g, bgRgb.b); // Rellena con tu nuevo color sólido
      } else {
        doc.setFillColor(255, 255, 255);
      }

      const align = ['left', 'center', 'right'].includes(card.textAlign) ? card.textAlign : 'center';
      let textX = x + 6;
      if (align === 'center') textX = x + (cardW / 2);
      if (align === 'right') textX = x + cardW - 6;

      // CALCULAR LUMINANCIA DE CONTROL: Invierte las fuentes automáticamente si el fondo es oscuro
      let useWhiteText = !!card.bgImage;
      if (!useWhiteText && bgRgb) {
        const luma = 0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b;
        useWhiteText = luma < 140;
      }

      const textColor = useWhiteText ? [255, 255, 255] : [15, 23, 42];
      const subColor = useWhiteText ? [148, 163, 184] : [100, 116, 139];
      const answerColor = useWhiteText ? [241, 245, 249] : [51, 65, 85];

      const qMaxW = cardW - 12;
      const aMaxW = cardW - 12;
      const qLines = doc.splitTextToSize(card.question || '', qMaxW);
      const aLines = doc.splitTextToSize(card.answer || '', aMaxW);

      // =======================================================================
      // ALGORITMO DE FILTRADO Y DIVISOR INTERMEDIO MÓVIL
      // =======================================================================
      let dividerY = y + 38;

      if (card.contentImage) {
        if (card.imageSide === 'question') {
          let answerAreaNeeded = 10 + (aLines.length * 4.5) + 4;
          dividerY = (y + 76) - answerAreaNeeded;
          if (dividerY < y + 34) dividerY = y + 34;
          if (dividerY > y + 55) dividerY = y + 55;
        } else if (card.imageSide === 'answer') {
          let questionAreaNeeded = 10 + (qLines.length * 4.5) + 4;
          dividerY = y + questionAreaNeeded;
          if (dividerY < y + 21) dividerY = y + 21;
          if (dividerY > y + 42) dividerY = y + 42;
        }
      }

      // Pintar marco contenedor
      doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2);
      doc.rect(x, y, cardW, cardH, card.bgImage ? 'S' : 'FD');

      // Dibujar línea discontinua equilibrada
      doc.setDrawColor(card.bgImage ? 100 : 210, card.bgImage ? 116 : 225, card.bgImage ? 139 : 235);
      doc.setLineDash([1, 1], 0);
      doc.line(x + 5, dividerY, x + cardW - 5, dividerY);
      doc.setLineDash([]);

      // =======================================================================
      // RENDEREADO DINÁMICO: SECCIÓN PREGUNTA
      // =======================================================================
      doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
      doc.text("PREGUNTA", textX, y + 8, { align });

      if (card.contentImage && card.imageSide === 'question') {
        let qTextBottom = y + 11 + (qLines.length * 4.5);
        let verticalGap = dividerY - qTextBottom - 2;

        let imgH = Math.max(14, Math.min(verticalGap, 32));
        let imgW = Math.min(imgH * 1.45, cardW - 16);
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
      // RENDEREADO DINÁMICO: SECCIÓN RESPUESTA
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
