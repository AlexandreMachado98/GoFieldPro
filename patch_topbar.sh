sed -i '/<div className="flex items-center gap-2">/,/<\/div>/d' src/components/Topbar.tsx
sed -i '/<div className="h-5 w-px bg-slate-800 hidden sm:block"><\/div>/d' src/components/Topbar.tsx
sed -i '/{\/\* View Tabs Bar \*\/}/,/<Header>/d' src/components/Topbar.tsx
# Oops, `<Header>` is actually `</header>`
