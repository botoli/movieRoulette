const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'game', 'src', 'App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

// We need to add `export type Suggestion...`
content = content.replace('type Suggestion = {', 'export type Suggestion = {');

// Find the main return function
const returnMatch = content.match(/  const copyShareLink = async \(\) => {[\s\S]*?  return \(/);
if (!returnMatch) throw new Error("Could not find return match");

const splitIndex = content.indexOf('  return (', returnMatch.index);

const newRender = `  return (
    <div className="night-ritual-space">
      <div className="space-grain" />
      <div className={clsx("ambient-glow", (isSpinning || winner) && "last-mode")} />

      <ParticipantNode position="top-left" name="Host" count={activeMovies.length} />
      <ParticipantNode position="top-right" name="Guest 1" count={0} />
      <ParticipantNode position="bottom-left" name="Guest 2" count={0} />
      <ParticipantNode position="bottom-right" name="Guest 3" count={0} />

      <RouletteCore 
        isSpinning={isSpinning} 
        isLastMode={activeMovies.length <= 3 && activeMovies.length > 0} 
        onSpin={spinRoulette} 
      />

      {activeMovies.map((movie, i) => {
        const isWinner = winner?.title === movie.title;
        const eliminateIndex = eliminatedMovies.findIndex(e => e.title === movie.title);
        const radius = isWinner ? 0 : 200 + (i % 3) * 50; 
        const angle = (Date.now() / 1000 + i * (Math.PI * 2 / activeMovies.length)) % (Math.PI * 2);
        
        return (
          <MovieToken 
            key={\`\${movie.title}-\${i}\`}
            movie={movie}
            radius={radius}
            angle={angle}
            isWinner={isWinner}
          />
        );
      })}

      <CommandPalette 
        isVisible={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={addMovie}
        suggestions={suggestions}
      />

      <div className="controls-overlay">
        <button onClick={copyShareLink}>Share Space</button>
        {winner && <button onClick={resetRoulette}>Reset</button>}
      </div>
    </div>
  );
}

export default App;
`;

const keepBefore = content.substring(0, splitIndex);

// Let's also add imports for the new components at the top
let finalContent = keepBefore + newRender;

// add imports
const importBlock = `
import { RouletteCore } from './components/RouletteCore/RouletteCore';
import { MovieToken } from './components/MovieToken/MovieToken';
import { ParticipantNode } from './components/ParticipantNode/ParticipantNode';
import { CommandPalette } from './components/CommandPalette/CommandPalette';
import clsx from 'clsx';
`;

finalContent = finalContent.replace('import "./App.scss";', "import './App.scss';\n" + importBlock);

// We need to add state for `isCommandPaletteOpen` 
finalContent = finalContent.replace('const [toast, setToast] = useState<string | null>(null);', 'const [toast, setToast] = useState<string | null>(null);\n  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);\n\n  useEffect(() => {\n    const handleKeyDown = (e: KeyboardEvent) => {\n      if (e.key === "Tab") {\n        e.preventDefault();\n        setIsCommandPaletteOpen(prev => !prev);\n      }\n    };\n    window.addEventListener("keydown", handleKeyDown);\n    return () => window.removeEventListener("keydown", handleKeyDown);\n  }, []);\n\n  // For orbital animation\n  const [, setRenderTick] = useState(0);\n  useEffect(() => {\n    if (isCommandPaletteOpen) return;\n    let animationFrame: number;\n    const loop = () => {\n      setRenderTick(t => t + 1);\n      animationFrame = requestAnimationFrame(loop);\n    };\n    animationFrame = requestAnimationFrame(loop);\n    return () => cancelAnimationFrame(animationFrame);\n  }, [isCommandPaletteOpen]);');


fs.writeFileSync(appPath, finalContent, 'utf8');
console.log("Patched App.tsx");
