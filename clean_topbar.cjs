const fs = require('fs');
let content = fs.readFileSync('src/components/Topbar.tsx', 'utf8');

const oldLeft = `<div className="flex items-center gap-2 sm:gap-3">
          <button 
            className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <button
              id="btn-project-dropdown"
              onClick={() => setIsProjectsDropdownOpen(!isProjectsDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-semibold text-slate-200 transition-colors"
            >
              <Folder className="w-4 h-4 text-sky-400" />
              <span className="max-w-[100px] sm:max-w-[300px] truncate">{activeProject.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {isProjectsDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 animate-in fade-in">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pastas de Projetos</div>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProject(p);
                      setIsProjectsDropdownOpen(false);
                    }}
                    className={\`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors \${
                      p.id === activeProject.id ? 'bg-sky-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'
                    }\`}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.id === activeProject.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 ml-1" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>`;

const newLeft = `<div className="flex items-center gap-2 sm:gap-3">
          <button 
            className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:block pl-2 border-l border-slate-800">
             <h1 className="text-sm font-bold text-white tracking-tight">GeoField <span className="text-sky-400">Pro</span></h1>
          </div>
        </div>`;

content = content.replace(oldLeft, newLeft);

fs.writeFileSync('src/components/Topbar.tsx', content);
