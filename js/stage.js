// =========================================
// stage.js - Random stage generator
// =========================================
const Stage = (() => {

  const PATTERNS = ['rows','diamond','checker','pyramid','spiral','random','fortress'];

  function generate(stageNum, canvasW, canvasH){
    const cols = 8;
    const margin = 8;
    const blockW = (canvasW - margin*2) / cols - 4;
    const blockH = 20;
    const startY = 70;

    // Difficulty scaling
    const rows = Math.min(6 + Math.floor(stageNum/2), 11);
    const toughChance = Math.min(0.05 + stageNum*0.03, 0.35);
    const steelChance = Math.min(stageNum*0.02, 0.18);
    const explosiveChance = Math.min(0.04 + stageNum*0.015, 0.14);
    const itemChance = 0.12;

    // Pick pattern
    const pattern = PATTERNS[(stageNum-1) % PATTERNS.length];
    const layout = buildPattern(pattern, cols, rows, stageNum);

    const blocks = [];
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        if(!layout[r][c]) continue;
        const x = margin + c * (blockW + 4) + 2;
        const y = startY + r * (blockH + 4);

        // Determine kind
        let kind;
        const roll = Math.random();
        if(roll < steelChance && r < rows-2) kind = 'steel';
        else if(roll < steelChance + toughChance) kind = 'tough';
        else if(roll < steelChance + toughChance + explosiveChance) kind = 'explosive';
        else kind = 'normal';

        // Item flag
        const opts = {};
        if(kind === 'normal' && Math.random() < itemChance){
          kind = 'item';
          opts.itemKind = pickItem();
        }

        if(kind === 'tough') opts.hp = 2 + (stageNum >= 5 && Math.random()<0.3 ? 1 : 0);

        blocks.push(new Block(c, r, x, y, blockW, blockH, kind, opts));
      }
    }
    return blocks;
  }

  function buildPattern(name, cols, rows, stageNum){
    const grid = Array.from({length:rows}, () => new Array(cols).fill(false));
    switch(name){
      case 'rows':
        for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) grid[r][c]=true;
        break;
      case 'checker':
        for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) grid[r][c]=((r+c)%2===0);
        break;
      case 'pyramid':
        for(let r=0;r<rows;r++){
          const half = Math.min(r+1, cols/2);
          for(let c=0;c<cols;c++){
            grid[r][c] = Math.abs(c - (cols-1)/2) < half;
          }
        }
        break;
      case 'diamond':
        for(let r=0;r<rows;r++){
          const dist = Math.abs(r - rows/2);
          const half = Math.max(1, cols/2 - dist);
          for(let c=0;c<cols;c++){
            grid[r][c] = Math.abs(c - (cols-1)/2) < half;
          }
        }
        break;
      case 'spiral':
        // simple alternating thick/thin rows
        for(let r=0;r<rows;r++){
          for(let c=0;c<cols;c++){
            if(r%2===0) grid[r][c] = true;
            else grid[r][c] = (c >= 1 && c <= cols-2);
          }
        }
        break;
      case 'fortress':
        // Outer wall of steel-leaning, inner gaps
        for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
          if(r===0 || r===rows-1 || c===0 || c===cols-1) grid[r][c]=true;
          else grid[r][c] = Math.random() < 0.55;
        }
        break;
      case 'random':
      default:
        for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
          grid[r][c] = Math.random() < 0.78;
        }
        break;
    }
    return grid;
  }

  function pickItem(){
    // weighted; bonus rare, life rarer
    const pool = ['long','long','multi','slow','pierce','magnet','bonus','life'];
    return pool[Math.floor(Math.random()*pool.length)];
  }

  return { generate };
})();
