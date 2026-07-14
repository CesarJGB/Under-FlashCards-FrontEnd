import { resolveCardPdfStyles, setPdfTextStyle } from '../styles';

/**
 * Renderiza el contenido en formato de examen limpio utilizando el contrato de constantes.
 */
export function renderContentDocument(doc, items, options) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Configuración de márgenes estilo examen (en mm)
    const marginX = 20; 
    const marginY = 20;
    const contentWidth = pageWidth - (marginX * 2);
    
    let currentY = marginY; 

    // ==========================================
    // RENDER DEL TÍTULO PRINCIPAL (Desde las constantes)
    // ==========================================
    if (options && options.title) {
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42); // Slate 900
        
        // Si el contexto inyecta el nombre del mazo, lo concatena; si no, usa el título base
        const mainTitle = options.deckName ? `${options.title}: ${options.deckName}` : options.title;
        doc.text(mainTitle, marginX, currentY + 6);
        currentY += 12;
        
        // Línea divisoria sutil estilo examen
        doc.setDrawColor(226, 232, 240); // #E2E8F0
        doc.setLineWidth(0.5);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 12;
    }

    // ==========================================
    // RENDER DEL LISTADO DE PREGUNTAS / RESPUESTAS
    // ==========================================
    items.forEach((item, index) => {
        const cardStyle = resolveCardPdfStyles(item);
        
        // Extracción estricta basada en el contrato de constantes
        const textQuestion = item.question || '';
        const textAnswer = item.answer || '';
        
        const qImage = item.questionImage || null;
        const aImage = item.answerImage || null;

        // --- 1. PRE-CÁLCULO DE ALTURAS ---
        let questionLines = [];
        let questionHeight = 0;
        const fontHeightMmQ = cardStyle.question.size * 0.352778; // pt a mm
        const lineHeightQ = fontHeightMmQ * 1.35; 
        
        if (options.sections.includes('question')) {
            setPdfTextStyle(doc, cardStyle.question);
            const fullQuestionText = `${index + 1}. ${textQuestion}`;
            questionLines = doc.splitTextToSize(fullQuestionText, contentWidth);
            questionHeight = questionLines.length * lineHeightQ;
            
            if (qImage && qImage.height) {
                questionHeight += qImage.height + 6; 
            }
        }
        
        let answerLines = [];
        let answerHeight = 0;
        const fontHeightMmA = cardStyle.answer.size * 0.352778;
        const lineHeightA = fontHeightMmA * 1.35;
        
        if (options.sections.includes('answer')) {
            setPdfTextStyle(doc, cardStyle.answer);
            const fullAnswerText = `R: ${textAnswer}`;
            answerLines = doc.splitTextToSize(fullAnswerText, contentWidth - 6);
            answerHeight = answerLines.length * lineHeightA;
            
            if (aImage && aImage.height) {
                answerHeight += aImage.height + 6;
            }
        }
        
        const totalBlockHeight = questionHeight + answerHeight + 8;

        // --- 2. CONTROL DE PAGINACIÓN (Keep Together) ---
        if (currentY + totalBlockHeight > pageHeight - marginY) {
            doc.addPage();
            currentY = marginY + 5; 
        }

        // --- 3. RENDERIZACIÓN DE LA PREGUNTA e IMAGEN ---
        if (options.sections.includes('question') && questionLines.length > 0) {
            setPdfTextStyle(doc, cardStyle.question);
            
            questionLines.forEach((line) => {
                doc.text(line, marginX, currentY + fontHeightMmQ);
                currentY += lineHeightQ;
            });
            
            if (qImage && qImage.src) {
                currentY += 2;
                doc.addImage(qImage.src, 'PNG', marginX, currentY, qImage.width, qImage.height);
                currentY += qImage.height + 4;
            }
        }
        
        // --- 4. RENDERIZACIÓN DE LA RESPUESTA e IMAGEN ---
        if (options.sections.includes('answer') && answerLines.length > 0) {
            currentY += 1.5; 
            setPdfTextStyle(doc, cardStyle.answer);
            
            answerLines.forEach((line) => {
                doc.text(line, marginX + 6, currentY + fontHeightMmA);
                currentY += lineHeightA;
            });
            
            if (aImage && aImage.src) {
                currentY += 2;
                doc.addImage(aImage.src, 'PNG', marginX + 6, currentY, aImage.width, aImage.height);
                currentY += aImage.height + 4;
            }
        }
        
        currentY += 6; // Separación limpia entre bloques
    });
}
