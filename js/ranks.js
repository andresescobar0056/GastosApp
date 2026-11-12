/**
 * Ranks System for Goals (10 Ranks from 10% to 100%)
 * Strictly NO emojis. All visual identities use vector SVG icons and bespoke styling.
 */

const RANKS_CONFIG = [
  {
    id: 'base',
    name: 'Iniciando',
    minPercent: 0,
    className: 'rank-base',
    color: '#64748B',
    description: 'Comenzando el plan de ahorro',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4l3 3"></path></svg>`
  },
  {
    id: 'papel',
    name: 'Papel',
    minPercent: 10,
    className: 'rank-papel',
    color: '#94A3B8',
    description: 'Primeros cimientos registrados',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
  },
  {
    id: 'bronce',
    name: 'Bronce',
    minPercent: 20,
    className: 'rank-bronce',
    color: '#F59E0B',
    description: 'Avance tangible y constante',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
  },
  {
    id: 'hierro',
    name: 'Hierro',
    minPercent: 30,
    className: 'rank-hierro',
    color: '#E2E8F0',
    description: 'Compromiso forjado y sólido',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
  },
  {
    id: 'amatista',
    name: 'Amatista',
    minPercent: 40,
    className: 'rank-amatista',
    color: '#C084FC',
    description: 'Crecimiento notable y enfocado',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><polygon points="6 3 18 3 22 9 12 22 2 9"></polygon><path d="M2 9h20"></path><path d="M12 22L7 9"></path><path d="M12 22l5-13"></path></svg>`
  },
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    minPercent: 50,
    className: 'rank-esmeralda',
    color: '#10B981',
    description: 'Punto medio alcanzado con éxito',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><polygon points="12 2 20 8 17 21 7 21 4 8"></polygon><line x1="12" y1="2" x2="12" y2="21"></line></svg>`
  },
  {
    id: 'bismuto',
    name: 'Bismuto',
    minPercent: 60,
    className: 'rank-bismuto',
    color: '#38BDF8',
    description: 'Estructura geométrica superior',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`
  },
  {
    id: 'rubi',
    name: 'Rubí',
    minPercent: 70,
    className: 'rank-rubi',
    color: '#FB7185',
    description: 'Alta intensidad y perseverancia',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><path d="M6 3h12l4 6-10 13L2 9z"></path><path d="M12 22V9"></path><path d="M2 9h20"></path></svg>`
  },
  {
    id: 'zafiro',
    name: 'Zafiro',
    minPercent: 80,
    className: 'rank-zafiro',
    color: '#60A5FA',
    description: 'Excelencia y meta muy cercana',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><polygon points="12 2 19 8 19 16 12 22 5 16 5 8"></polygon><line x1="12" y1="2" x2="12" y2="22"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
  },
  {
    id: 'paladio',
    name: 'Paladio',
    minPercent: 90,
    className: 'rank-paladio',
    color: '#EEF2FF',
    description: 'Pureza máxima en la recta final',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
  },
  {
    id: 'diamante',
    name: 'Diamante',
    minPercent: 100,
    className: 'rank-diamante',
    color: '#FFFFFF',
    description: 'Meta cumplida al 100%',
    iconSvg: `<svg viewBox="0 0 24 24" class="icon"><polygon points="6 2 18 2 22 8 12 22 2 8 6 2"></polygon><line x1="2" y1="8" x2="22" y2="8"></line><line x1="12" y1="2" x2="8" y2="8"></line><line x1="12" y1="2" x2="16" y2="8"></line><line x1="12" y1="22" x2="7" y2="8"></line><line x1="12" y1="22" x2="17" y2="8"></line></svg>`
  }
];

class RankSystem {
  static getRankByPercentage(percentage) {
    const pct = Math.max(0, Math.floor(percentage));
    // Check backwards from Diamante (100) down to Papel (10)
    for (let i = RANKS_CONFIG.length - 1; i >= 0; i--) {
      if (pct >= RANKS_CONFIG[i].minPercent) {
        return RANKS_CONFIG[i];
      }
    }
    return RANKS_CONFIG[0];
  }

  static getProgress(saved, target) {
    if (!target || target <= 0) return 0;
    return Math.floor((saved / target) * 100);
  }

  static renderBadge(percentage) {
    const rank = this.getRankByPercentage(percentage);
    return `
      <span class="rank-badge ${rank.className}" title="${rank.description}">
        ${rank.iconSvg}
        <span>${rank.name}</span>
      </span>
    `;
  }
}

window.RankSystem = RankSystem;
window.RANKS_CONFIG = RANKS_CONFIG;
