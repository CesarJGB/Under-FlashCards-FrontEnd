import { pdfStyles } from '../styles';

/**
 * Renderiza el contenido en formato de examen limpio.
 * Evita que las preguntas, respuestas e imágenes se separen incorrectamente entre páginas.
 */
export function renderContent(doc, items, options) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Configuración de márgenes estilo examen
    const marginX = 20; 
    const marginY = 20;
    const contentWidth = pageWidth - (marginX * 2);
    
    // Posición inicial (asumiendo que el header ya ocupó espacio)
    let currentY = marginY + 15; 

    items.forEach((item, index) => {
        // ==========================================
        // 1. PRE-CÁLCULO DE ALTURAS (Simulación)
        // ==========================================
        let questionLines = [];
        let questionHeight = 0;
        
        if (options.sections.includes('question')) {
            doc.setFont(pdfStyles.fontFamily || 'Helvetica', 'bold');
            doc.setFontSize(pdfStyles.fontSizeQuestion || 12);
            
            // Formato de examen: "1. ¿Qué es un mol?"
            const questionText = `${index + 1}. ${item.questionText}`;
            questionLines = doc.splitTextToSize(questionText, contentWidth);
            questionHeight = questionLines.length * (pdfStyles.lineHeight || 6);
            
            if (item.questionImage) {
                // Altura de la imagen + un pequeño margen interno
                questionHeight += item.questionImage.height + 6; 
            }
        }
        
        let answerLines = [];
        let answerHeight = 0;
        
        if (options.sections.includes('answer')) {
            doc.setFont(pdfStyles.fontFamily || 'Helvetica', 'normal');
            doc.setFontSize(pdfStyles.fontSizeAnswer || 11);
            
            const answerText = `R: ${item.answerText}`;
            // Las respuestas llevan una ligera sangría a la izquierda (contentWidth - 6)
            answerLines = doc.splitTextToSize(answerText, contentWidth - 6);
            answerHeight = answerLines.length * (pdfStyles.lineHeight || 5) + 2;
            
            if (item.answerImage) {
                answerHeight += item.answerImage.height + 6;
            }
        }
        
        // Altura total requerida para este conjunto (Pregunta + Respuesta + Imágenes + Espaciado)
        const totalBlockHeight = questionHeight + answerHeight + 8;

        // ==========================================
        // 2. CONTROL DE PAGINACIÓN (Keep Together)
        // ==========================================
        // Si el bloque completo NO cabe en el espacio restante de la página actual,
        // movemos todo el conjunto a la siguiente página para evitar huérfanos.
        if (currentY + totalBlockHeight > pageHeight - marginY) {
            doc.addPage();
            currentY = marginY + 10; // Reiniciamos el Y en la nueva página
        }

        // ==========================================
        // 3. RENDERIZACIÓN REAL EN EL PDF
        // ==========================================
        
        // --- Render de la Pregunta e Imagen asociados ---
        if (options.sections.includes('question')) {
            doc.setFont(pdfStyles.fontFamily || 'Helvetica', 'bold');
            doc.setFontSize(pdfStyles.fontSizeQuestion || 12);
            doc.setTextColor(pdfStyles.colors.textDark || '#1A202C');
            
            doc.text(questionLines, marginX, currentY);
            currentY += questionLines.length * (pdfStyles.lineHeight || 6);
            
            if (item.questionImage) {
                currentY += 2; // Separación del texto
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
        
        // --- Render de la Respuesta e Imagen asociados ---
        if (options.sections.includes('answer')) {
            currentY += 2; // Espacio entre pregunta y respuesta
            
            doc.setFont(pdfStyles.fontFamily || 'Helvetica', 'normal');
            doc.setFontSize(pdfStyles.fontSizeAnswer || 11);
            doc.setTextColor(pdfStyles.colors.textMuted || '#4A5568'); // Un tono más suave para la respuesta
            
            // Pintamos con una sangría de 6 unidades a la derecha para simular formato examen
            doc.text(answerLines, marginX + 6, currentY);
            currentY += answerLines.length * (pdfStyles.lineHeight || 5);
            
            if (item.answerImage) {
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
        
        // Separación limpia e invisible entre bloques de preguntas
        currentY += 10; 
    });
}
