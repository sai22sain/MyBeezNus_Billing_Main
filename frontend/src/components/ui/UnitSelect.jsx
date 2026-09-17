import React, { useEffect, useId, useRef, useState } from 'react';
import { findUnit, getUnitLabel, UNIT_DEFINITIONS } from '../../utils/units';

function UnitSelect({ value, onChange, disabled = false, error, placeholder = 'Select unit', allowSearch = true }) {
  const instanceId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState({});
  const selectedUnit = findUnit(value);
  const selectedIndex = selectedUnit ? UNIT_DEFINITIONS.findIndex(unit => unit.value === selectedUnit.value) : -1;
  const filteredUnits = UNIT_DEFINITIONS.filter(unit => {
    const searchText = `${unit.code} ${unit.value} ${unit.label} ${unit.aliases.join(' ')}`.toLowerCase();
    return searchText.includes(query.trim().toLowerCase());
  });

  const positionMenu = () => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    const maxHeight = Math.min(320, window.innerHeight - trigger.bottom - 16);
    const openAbove = maxHeight < 180 && trigger.top > window.innerHeight - trigger.bottom;
    setMenuStyle({
      left: trigger.left,
      width: trigger.width,
      ...(openAbove ? { bottom: window.innerHeight - trigger.top + 4 } : { top: trigger.bottom + 4 }),
      maxHeight: Math.max(180, openAbove ? trigger.top - 16 : maxHeight),
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    positionMenu();
    const closeOnOutside = event => {
      if (!rootRef.current?.contains(event.target) && !event.target.closest('.unit-select-menu')) setOpen(false);
    };
    const reposition = () => positionMenu();
    document.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (allowSearch) searchRef.current?.focus();
    else optionRefs.current[highlightedIndex]?.focus();
  }, [open, allowSearch, highlightedIndex]);

  useEffect(() => {
    if (!open || !filteredUnits.length) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlightedIndex, filteredUnits.length]);

  const selectUnit = unit => {
    onChange(unit.value);
    setQuery('');
    setOpen(false);
    triggerRef.current?.focus();
  };

  const openMenu = () => {
    if (disabled) return;
    const nextIndex = selectedIndex >= 0 ? filteredUnits.findIndex(unit => unit.value === selectedUnit.value) : 0;
    setHighlightedIndex(Math.max(0, nextIndex));
    setOpen(true);
  };

  const handleKeyDown = event => {
    if (!open && ['Enter', ' ', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex(index => Math.min(index + 1, filteredUnits.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredUnits[highlightedIndex]) selectUnit(filteredUnits[highlightedIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="unit-select">
      <button
        ref={triggerRef}
        type="button"
        className={`unit-select-trigger${error ? ' has-error' : ''}`}
        aria-label="Unit"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${instanceId}-options`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className={selectedUnit || value ? '' : 'unit-select-placeholder'}>{selectedUnit || value ? getUnitLabel(value) : placeholder}</span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} aria-hidden="true"></i>
      </button>
      {error && <span className="unit-select-error">{error}</span>}
      {open && <div className="unit-select-menu" id={`${instanceId}-options`} role="listbox" aria-label="Units" style={menuStyle} onKeyDown={handleKeyDown}>
        {allowSearch && <div className="unit-select-search-wrap"><i className="fas fa-search" aria-hidden="true"></i><input ref={searchRef} type="search" value={query} placeholder="Search units..." aria-label="Search units" onChange={event => { setQuery(event.target.value); setHighlightedIndex(0); }} onKeyDown={handleKeyDown} /></div>}
        <div className="unit-select-options">
          {filteredUnits.map((unit, index) => <button
            ref={element => { optionRefs.current[index] = element; }}
            type="button"
            role="option"
            aria-selected={unit.value === selectedUnit?.value}
            className={`unit-select-option${unit.value === selectedUnit?.value ? ' selected' : ''}${index === highlightedIndex ? ' highlighted' : ''}`}
            key={unit.value}
            onMouseDown={event => event.preventDefault()}
            onClick={() => selectUnit(unit)}
          ><span>{unit.label}</span>{unit.value === selectedUnit?.value && <i className="fas fa-check" aria-hidden="true"></i>}</button>)}
          {!filteredUnits.length && <div className="unit-select-empty">No matching units</div>}
        </div>
      </div>}
    </div>
  );
}

export default UnitSelect;
