export function buildQuickViewNavigationTarget(materia) {
  if (!materia) return null;

  const activeParciales = materia.activeParciales || [];
  const isFiltered = activeParciales.length > 0 && activeParciales.length < 3;

  if (!isFiltered) {
    return {
      materiaId: materia.id,
      parcialNumber: null,
      temaId: null,
      subtemaId: null
    };
  }

  if (activeParciales.length === 1) {
    return {
      materiaId: materia.id,
      parcialNumber: activeParciales[0],
      temaId: null,
      subtemaId: null
    };
  }

  return {
    materiaId: materia.id,
    parcialNumber: null,
    temaId: null,
    subtemaId: null,
    filterActiveParciales: true
  };
}
