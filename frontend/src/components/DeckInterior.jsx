// ARCHIVO: frontend/src/components/DeckInterior.jsx
import { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'; 
import { jsPDF } from 'jspdf';
import ReviewMode from './ReviewMode';
import DeckHeader from './DeckHeader';
import FlashcardCreator from './FlashcardCreator';
import FlashcardGrid from './FlashcardGrid';
import FastDeleteMode from './FastDeleteMode'; 

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function DeckInterior({ deck, userId, onBack, initialMode = 'edit' }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(initialMode);
  
  // 🌟 CONFIGURACIÓN DE UX: Estado para controlar el colapso de la lista (Cerrado por defecto)
  const [showGrid, setShowGrid] = useState(false);
  
  // Estados compartidos del formulario
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [textAlign, setTextAlign] = useState('center');
  const [fontSize, setFontSize] = useState('text-base');
  const [showStyles, setShowStyles] = useState(false);
  const [isBulk, setIsBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [defaultStyles, setDefaultStyles] = useState({ bgImage: '', textAlign: 'center', fontSize: 'text-base' });
  
  // 🖼️ NUEVOS ESTADOS: Controladores de la imagen de contenido y su respectivo lado (P o R)
  const [contentImage, setContentImage] = useState('');
  const [imageSide, setImageSide] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/deck/${deck.id}`);
      if (!res.ok) throw new Error('No se pudieron cargar las tarjetas.');
      setCards(await res.json());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [deck.id]);

  useEffect(() => { loadCards(); }, [loadCards]);

  useEffect(() => {
    if (editingId === null) setDefaultStyles({ bgImage, textAlign, fontSize });
  }, [bgImage, textAlign, fontSize, editingId]);

  const resetForm = () => {
    setQuestion(''); setAnswer(''); setBulkText('');
    setBgImage(defaultStyles.bgImage); setTextAlign(defaultStyles.textAlign);
    setFontSize(defaultStyles.fontSize); setEditingId(null);
    setContentImage(''); setImageSide(''); 
  };

  const handleExport = async () => {
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}/export`);
      if (!res.ok) throw new Error('No se pudo exportar el mazo.');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(deck.title || 'mazo').replace(/[^\w\s-]/g, '').trim() || 'mazo'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

    const handleExportPDF = (type = 'guide') => {
    if (cards.length === 0) {
      setError('No hay tarjetas en este mazo para exportar a PDF.');
      return;
    }

    setError('');
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const safeName = (deck.title || 'guia-estudio').replace(/[^\w\s-]/g, '').trim();

      // =======================================================================
      // FORMATO A: GUÍA DE ESTUDIO (LISTADO VERTICAL CONTINUO)
      // =======================================================================
      if (type === 'guide') {
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);

        doc.setFont("Helvetica", "bold"); doc.setFontSize(22);
        doc.text(`Guía de Estudio: ${deck.title}`, margin, 22);
        doc.setFont("Helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
        doc.text(`Total de tarjetas: ${cards.length} | Generado el ${new Date().toLocaleDateString()}`, margin, 29);

        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.5); doc.line(margin, 32, pageWidth - margin, 32);

        let y = 42;
        cards.forEach((card) => {
          const qLines = doc.splitTextToSize(`P: ${card.question}`, contentWidth);
          const aLines = doc.splitTextToSize(`R: ${card.answer}`, contentWidth);
          
          // Calcular altura dinámica sumando las imágenes de contenido si existen
          let imgHeight = card.contentImage ? 34 : 0;
          const blockHeight = (qLines.length * 6) + (aLines.length * 6) + 14 + imgHeight;

          if (y + blockHeight > 275) { doc.addPage(); y = 22; }

          doc.setFillColor(250, 250, 250); doc.setDrawColor(241, 245, 249);
          doc.roundedRect(margin - 2, y - 6, contentWidth + 4, blockHeight - 4, 3, 3, "FD");

          doc.setFont("Helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
          qLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
          y += (qLines.length * 6) + 3;

          // 🖼️ Inyección de Imagen de Contenido en la Pregunta (Guía)
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

          // 🖼️ Inyección de Imagen de Contenido en la Respuesta (Guía)
          if (card.contentImage && card.imageSide === 'answer') {
            try {
              let imgFormat = 'JPEG';
              if (card.contentImage.includes('image/png')) imgFormat = 'PNG';
              if (card.contentImage.includes('image/webp')) imgFormat = 'WEBP';
              doc.addImage(card.contentImage, imgFormat, margin, y, 45, 30, undefined, 'FAST');
            } catch (e) { console.error(e); }
            y += 32;
          }
          
          y += 8; // Margen de separación entre bloques de tarjetas
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

          // Fondo general del mazo
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

          // 🧠 ESTRATEGIA ADAPTATIVA: Si hay imagen de contenido, recalculamos anchos y X
          let qMaxW = cardW - 12;
          let qTextX = textX;
          if (card.contentImage && card.imageSide === 'question') {
            qMaxW = cardW - 36; // Encogemos el texto a la izquierda para dejar 24mm libres
            if (align === 'center') qTextX = x + (cardW - 24) / 2;
            if (align === 'right') qTextX = x + cardW - 32;

            try {
              let imgFormat = 'JPEG';
              if (card.contentImage.includes('image/png')) imgFormat = 'PNG';
              if (card.contentImage.includes('image/webp')) imgFormat = 'WEBP';
              // Dibujamos la miniatura en la mitad derecha del segmento de la pregunta
              doc.addImage(card.contentImage, imgFormat, x + cardW - 28, y + 13, 22, 18, undefined, 'FAST');
            } catch (e) { console.error(e); }
          }

          let aMaxW = cardW - 12;
          let aTextX = textX;
          if (card.contentImage && card.imageSide === 'answer') {
            aMaxW = cardW - 36; // Encogemos texto de respuesta
            if (align === 'center') aTextX = x + (cardW - 24) / 2;
            if (align === 'right') aTextX = x + cardW - 32;

            try {
              let imgFormat = 'JPEG';
              if (card.contentImage.includes('image/png')) imgFormat = 'PNG';
              if (card.contentImage.includes('image/webp')) imgFormat = 'WEBP';
              // Dibujamos la miniatura en la mitad derecha del segmento de la respuesta
              doc.addImage(card.contentImage, imgFormat, x + cardW - 28, y + 47, 22, 18, undefined, 'FAST');
            } catch (e) { console.error(e); }
          }

          const qLines = doc.splitTextToSize(card.question || '', qMaxW);
          const aLines = doc.splitTextToSize(card.answer || '', aMaxW);

          // --- Render Sección Pregunta ---
          doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
          doc.text("PREGUNTA", qTextX, y + 11, { align });

          doc.setFont("Helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          let currentY = y + 16;
          qLines.slice(0, 4).forEach((line) => {
            doc.text(line, qTextX, currentY, { align });
            currentY += 4.5;
          });

          // Línea divisora central
          doc.setDrawColor(card.bgImage ? 71 : 226, card.bgImage ? 85 : 232, card.bgImage ? 105 : 240);
          doc.line(x + 6, y + 38, x + cardW - 6, y + 38);

          // --- Render Sección Respuesta ---
          doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
          doc.text("RESPUESTA", aTextX, y + 45, { align });

          doc.setFont("Helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(answerColor[0], answerColor[1], answerColor[2]);
          currentY = y + 50;
          aLines.slice(0, 4).forEach((line) => {
            doc.text(line, aTextX, currentY, { align });
            currentY += 4.5;
          });
        });

        doc.save(`${safeName}-tarjetas.pdf`);
      }
    } catch (err) {
      console.error(err);
      setError(`Error de renderizado de PDF: ${err.message}`);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (isBulk && !editingId) {
      const lines = bulkText.split('\n');
      const parsedCards = [];
      let currentQuestion = '';

      lines.forEach((line) => {
        const cleanLine = line.trim();
        if (/^[pP]\s*:/i.test(cleanLine)) currentQuestion = cleanLine.replace(/^[pP]\s*:/i, '').trim();
        else if (/^[rR]\s*:/i.test(cleanLine)) {
          const currentAnswer = cleanLine.replace(/^[rR]\s*:/i, '').trim();
          if (currentQuestion && currentAnswer) {
            parsedCards.push({ question: currentQuestion, answer: currentAnswer });
            currentQuestion = '';
          }
        }
      });

      if (parsedCards.length === 0) {
        setError('No se encontraron bloques válidos (P: ... R: ...)');
        setSaving(false); return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/flashcards/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deckId: deck.id, batchStyles: { bgImage, textAlign, fontSize }, cards: parsedCards }),
        });
        if (!res.ok) throw new Error('No se pudo guardar el lote.');
        const batchData = await res.json();
        setCards((prev) => [...batchData, ...prev]);
        resetForm(); setIsBulk(false);
      } catch (err) { setError(err.message); } finally { setSaving(false); }
      return;
    }

    if (!question.trim() || !answer.trim()) { setSaving(false); return; }

    const body = { question, answer, bgImage, textAlign, fontSize, contentImage, imageSide };

    try {
      if (editingId) {
        const res = await fetch(`${BACKEND_URL}/api/flashcards/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('No se pudo actualizar.');
        const updated = await res.json();
        setCards((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        resetForm(); 
      } else {
        const res = await fetch(`${BACKEND_URL}/api/flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deckId: deck.id, ...body }),
        });
        if (!res.ok) throw new Error('No se pudo crear.');
        const newCard = await res.json();
        setCards((prev) => [newCard, ...prev]);
        
        setQuestion(''); 
        setAnswer('');
        setContentImage(''); 
        setImageSide(''); 
      }
    } catch (e) { 
      setError(e.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleEdit = (card) => {
    setIsBulk(false); setEditingId(card.id); setQuestion(card.question); setAnswer(card.answer);
    setBgImage(card.bgImage || ''); setTextAlign(card.textAlign || 'center'); setFontSize(card.fontSize || 'text-base');
    setContentImage(card.contentImage || '');
    setImageSide(card.imageSide || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowGrid(true);
  };

  const handleDelete = async (card) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/${card.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (editingId === card.id) resetForm();
    } catch { /* error */ }
  };

  return (
    <div data-testid="deck-interior">
      <DeckHeader 
        deck={deck} 
        mode={mode} 
        setMode={setMode} 
        onBack={onBack} 
        onExport={handleExport} 
        onExportPDF={handleExportPDF} 
      />

      {loading ? (
        <div className="mt-12 flex flex-col items-center justify-center gap-3 text-slate-400 py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
          <p className="text-sm font-medium">Preparando tus tarjetas de estudio…</p>
        </div>
      ) : (
        <>
          {mode === 'review' && <ReviewMode cards={cards} loading={loading} />}
          
          {mode === 'fast-delete' && (
            <FastDeleteMode 
              cards={cards} 
              onDelete={handleDelete} 
              onClose={() => setMode('edit')} 
            />
          )}

          {mode === 'edit' && (
            <>
              <FlashcardCreator
                question={question} setQuestion={setQuestion} answer={answer} setAnswer={setAnswer}
                bgImage={bgImage} setBgImage={setBgImage} textAlign={textAlign} setTextAlign={setTextAlign}
                fontSize={fontSize} setFontSize={setFontSize} showStyles={showStyles} setShowStyles={setShowStyles}
                isBulk={isBulk} setIsBulk={setIsBulk} bulkText={bulkText} setBulkText={setBulkText}
                editingId={editingId} saving={saving} error={error} setError={setError}
                onSubmit={handleSubmit} onCancel={resetForm}
                contentImage={contentImage} setContentImage={setContentImage}
                imageSide={imageSide} setImageSide={setImageSide}
                onFastDelete={() => setMode('fast-delete')}
                hasCards={cards.length > 0}
              />
              
              {/* 🌟 ACORDEÓN DESPLEGABLE DE TARJETAS CREADAS */}
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className="mt-6 w-full flex items-center justify-between bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl px-5 py-3.5 transition-colors shadow-xs active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Colección de tarjetas del mazo
                  </h3>
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-slate-200/50">
                    {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
                  </span>
                </div>
                {showGrid ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Contenedor de la rejilla */}
              {showGrid && (
                <div className="animate-[fadeIn_0.18s_ease] pb-6">
                  <FlashcardGrid cards={cards} onEdit={handleEdit} onDelete={handleDelete} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
