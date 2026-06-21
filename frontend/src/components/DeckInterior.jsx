import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import ReviewMode from './ReviewMode';
import DeckHeader from './DeckHeader';
import FlashcardCreator from './FlashcardCreator';
import FlashcardGrid from './FlashcardGrid';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function DeckInterior({ deck, userId, onBack, initialMode = 'edit' }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(initialMode);
  
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

  // Motor de Exportación a PDF con Filtro de Contraste Reparado
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

      // MODO A: GUÍA DE TEXTO PLANO
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
          const blockHeight = (qLines.length * 6) + (aLines.length * 6) + 12;

          if (y + blockHeight > 275) { doc.addPage(); y = 22; }

          doc.setFillColor(250, 250, 250); doc.setDrawColor(241, 245, 249);
          doc.roundedRect(margin - 2, y - 6, contentWidth + 4, blockHeight - 4, 3, 3, "FD");

          doc.setFont("Helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(15, 23, 42);
          qLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
          y += (qLines.length * 6) + 3;

          doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(71, 85, 105);
          aLines.forEach((line, i) => { doc.text(line, margin, y + (i * 6)); });
          y += (aLines.length * 6) + 12;
        });

        doc.save(`${safeName}-guia.pdf`);
        return;
      }

      // MODO B: TARJETAS VISUALES IMPRIMIBLES (REJILLA DE 2x3)
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
              
              // 1. Dibujar la imagen base original
              doc.addImage(card.bgImage, imgFormat, x, y, cardW, cardH, undefined, 'FAST');
              
              // 🌟 2. FILTRO DE CONTRASTE: Aplicamos una capa negra al 55% de opacidad sobre la foto
              doc.saveGraphicsState();
              doc.setGState(new doc.GState({ opacity: 0.55 }));
              doc.setFillColor(15, 23, 42); // Slate 900 / Negro traslúcido
              doc.rect(x, y, cardW, cardH, 'F');
              doc.restoreGraphicsState(); // Restaura la opacidad al 100% para que las letras no salgan transparentes
            } catch (imgErr) {
              doc.setFillColor(30, 41, 59);
              doc.rect(x, y, cardW, cardH, 'F');
            }
          } else {
            doc.setFillColor(255, 255, 255);
          }

          // Contorno exterior guía para el recorte
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.2);
          doc.rect(x, y, cardW, cardH, card.bgImage ? 'S' : 'FD');

          const maxTextWidth = cardW - 12;
          const align = ['left', 'center', 'right'].includes(card.textAlign) ? card.textAlign : 'center';
          
          let textX = x + 6;
          if (align === 'center') textX = x + (cardW / 2);
          if (align === 'right') textX = x + cardW - 6;

          const qLines = doc.splitTextToSize(card.question || '', maxTextWidth);
          const aLines = doc.splitTextToSize(card.answer || '', maxTextWidth);

          const textColor = card.bgImage ? [255, 255, 255] : [15, 23, 42];
          const subColor = card.bgImage ? [148, 163, 184] : [100, 116, 139];
          const answerColor = card.bgImage ? [241, 245, 249] : [51, 65, 85];

          // Bloque Pregunta
          doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
          doc.text("PREGUNTA", textX, y + 11, { align });

          doc.setFont("Helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          let currentY = y + 17;
          qLines.slice(0, 4).forEach((line) => {
            doc.text(line, textX, currentY, { align });
            currentY += 4.5;
          });

          // Divisor de Tarjeta
          doc.setDrawColor(card.bgImage ? 71 : 226, card.bgImage ? 85 : 232, card.bgImage ? 105 : 240);
          doc.line(x + 6, y + 38, x + cardW - 6, y + 38);

          // Bloque Respuesta
          doc.setFont("Helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(subColor[0], subColor[1], subColor[2]);
          doc.text("RESPUESTA", textX, y + 45, { align });

          doc.setFont("Helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(answerColor[0], answerColor[1], answerColor[2]);
          currentY = y + 51;
          aLines.slice(0, 4).forEach((line) => {
            doc.text(line, textX, currentY, { align });
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
    const body = { question, answer, bgImage, textAlign, fontSize };
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
        setQuestion(''); setAnswer('');
      }
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleEdit = (card) => {
    setIsBulk(false); setEditingId(card.id); setQuestion(card.question); setAnswer(card.answer);
    setBgImage(card.bgImage || ''); setTextAlign(card.textAlign || 'center'); setFontSize(card.fontSize || 'text-base');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          {mode === 'edit' && (
            <>
              <FlashcardCreator
                question={question} setQuestion={setQuestion} answer={answer} setAnswer={setAnswer}
                bgImage={bgImage} setBgImage={setBgImage} textAlign={textAlign} setTextAlign={setTextAlign}
                fontSize={fontSize} setFontSize={setFontSize} showStyles={showStyles} setShowStyles={setShowStyles}
                isBulk={isBulk} setIsBulk={setIsBulk} bulkText={bulkText} setBulkText={setBulkText}
                editingId={editingId} saving={saving} error={error} setError={setError}
                onSubmit={handleSubmit} onCancel={resetForm}
              />
              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tarjetas</h3>
                <span className="text-xs font-medium text-slate-400">{cards.length} en total</span>
              </div>
              <FlashcardGrid cards={cards} onEdit={handleEdit} onDelete={handleDelete} />
            </>
          )}
        </>
      )}
    </div>
  );
}
