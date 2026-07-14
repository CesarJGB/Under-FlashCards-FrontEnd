import { resolveCardPdfStyles, setPdfTextStyle } from '../styles';

/**
 * Renderiza el contenido en formato de examen limpio.
 * Previene que las preguntas, respuestas e imágenes se separen incorrectamente entre páginas.
 */
export function renderContentDocument(doc, items, options) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Configuración de márgenes estilo examen (en mm)
    const marginX = 20; 
    const marginY = 20;
    const contentWidth = pageWidth - (marginX * 2);
    
    // Posición Y inicial
    let currentY = marginY + 15; 

    items.forEach((item, index) => {
        // 1. Resolver los estilos específicos de esta tarjeta (fuentes, tamaños, colores)
        const cardStyle = resolveCardPdfStyles(item);
        
        // ==========================================
        // 2. PRE-CÁLCULO DE ALTURAS EN MILÍMETROS
        // ==========================================
        let questionLines = [];
        let questionHeight = 0;
        
        if (options.sections.includes('question')) {
            // Aplicamos el estilo temporalmente para calcular el ajuste de líneas real
            setPdfTextStyle(doc, cardStyle.question);
            
            const questionText = `${index + 1}. ${item.questionText || ''}`;
            questionLines = doc.splitTextToSize(questionText, contentWidth);
            
            // Convertimos los puntos (pt) de la fuente a milímetros (mm) para jsPDF
            const fontHeightMm = cardStyle.question.size * 0.352778;
            const lineHeight = fontHeightMm * 1.35; // Interlineado del 35%
            
            questionHeight = questionLines.length * lineHeight;
            
            if (item.questionImage && item.questionImage.height) {
                questionHeight += item.questionImage.height + 6; 
            }
        }
        
        let answerLines = [];
        let answerHeight = 0;
        
        if (options.sections.includes('answer')) {
            setPdfTextStyle(doc, cardStyle.answer);
            
            const answerText = `R: ${item.answerText || ''}`;
            // Las respuestas llevan una sangría de 6mm a la derecha
            answerLines = doc.splitTextToSize(answerText, contentWidth - 6);
            
            const fontHeightMm = cardStyle.answer.size * 0.352778;
            const lineHeight = fontHeightMm * 1.35;
            
            answerHeight = answerLines.length * lineHeight;
            
            if (item.answerImage && item.answerImage.height) {
                answerHeight += item.answerImage.height + 6;
            }
        }
        
        // Altura total requerida para mantener el bloque unido (Pregunta + Respuesta + Imágenes)
        const totalBlockHeight = questionHeight + answerHeight + 10;

        // ==========================================
        // 3. CONTROL DE PAGINACIÓN (Keep Together)
        // ==========================================
        // Si el bloque completo con sus imágenes NO cabe, se pasa entero a la siguiente página
        if (currentY + totalBlockHeight > pageHeight - marginY) {
            doc.addPage();
            currentY = marginY + 10; 
        }

        // ==========================================
        // 4. RENDERIZACIÓN REAL
        // ==========================================
        
        // --- Render de la Pregunta ---
        if (options.sections.includes('question')) {
            setPdfTextStyle(doc, cardStyle.question);
            
            const fontHeightMm = cardStyle.question.size * 0.352778;
            const lineHeight = fontHeightMm * 1.35;

            // Dibujamos línea por línea para controlar el Y exacto junto con las imágenes
            questionLines.forEach((line) => {
                doc.text(line, marginX, currentY + fontHeightMm);
                currentY += lineHeight;
            });
            
            if (item.questionImage && item.questionImage.src) {
                currentY += 2; 
                doc.addImage(
                    item.questionImage.src, 
                    'PNG', 
                    marginX, 
                    currentY, 
                    item.questionImage.width, 
                    item.questionImage.height
                );
                currentY += item.questionImage.height + 4;
            }
        }
        
        // --- Render de la Respuesta ---
        if (options.sections.includes('answer')) {
            currentY += 1.5; // Pequeño espacio de separación con la pregunta
            setPdfTextStyle(doc, cardStyle.answer);
            
            const fontHeightMm = cardStyle.answer.size * 0.352778;
            const lineHeight = fontHeightMm * 1.35;
            
            answerLines.forEach((line) => {
                // Aplicamos la sangría horizontal sumando 6 al margen izquierdo
                doc.text(line, marginX + 6, currentY + fontHeightMm);
                currentY += lineHeight;
            });
            
            if (item.answerImage && item.answerImage.src) {
                currentY += 2;
                doc.addImage(
                    item.answerImage.src, 
                    'PNG', 
                    marginX + 6, 
                    currentY, 
                    item.answerImage.width, 
                    item.answerImage.height
                );
                currentY += item.answerImage.height + 4;
            }
        }
        
        // Espaciado de separación limpio e invisible antes de la siguiente pregunta
        currentY += 8; 
    });
}
