import React, { useEffect, useState, useMemo, useCallback, useRef, useContext } from "react";
import { Search, Trash2, AlertCircle, Loader } from "lucide-react";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import styles from "@/styles/FilterPreferences.module.css";

const LANGUAGES = [
  { code:"ar",name:"Arabic" },{ code:"bn",name:"Bengali" },{ code:"cs",name:"Czech" },
  { code:"da",name:"Danish" },{ code:"de",name:"German" },{ code:"el",name:"Greek" },
  { code:"en",name:"English" },{ code:"es",name:"Spanish" },{ code:"fa",name:"Persian" },
  { code:"fi",name:"Finnish" },{ code:"fr",name:"French" },{ code:"gu",name:"Gujarati" },
  { code:"he",name:"Hebrew" },{ code:"hi",name:"Hindi" },{ code:"hu",name:"Hungarian" },
  { code:"id",name:"Indonesian" },{ code:"it",name:"Italian" },{ code:"ja",name:"Japanese" },
  { code:"jv",name:"Javanese" },{ code:"ko",name:"Korean" },{ code:"ms",name:"Malay" },
  { code:"mr",name:"Marathi" },{ code:"nl",name:"Dutch" },{ code:"no",name:"Norwegian" },
  { code:"pa",name:"Punjabi" },{ code:"pl",name:"Polish" },{ code:"pt",name:"Portuguese" },
  { code:"ro",name:"Romanian" },{ code:"ru",name:"Russian" },{ code:"sv",name:"Swedish" },
  { code:"ta",name:"Tamil" },{ code:"te",name:"Telugu" },{ code:"th",name:"Thai" },
  { code:"tr",name:"Turkish" },{ code:"uk",name:"Ukrainian" },{ code:"ur",name:"Urdu" },
  { code:"vi",name:"Vietnamese" },{ code:"zh",name:"Chinese" }
].sort((a,b)=>a.name.localeCompare(b.name));

const Chip = ({ label, onRemove }) => (
  <span className={styles.chip}>
    {label}
    <Trash2 size={14} onClick={onRemove} className={styles.removeIcon} />
  </span>
);

const SearchableSelect = ({ options, onSelect, placeholder, disabled, currentIds }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(
    () => options.filter(o => !currentIds.has(o.id) && o.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [options, currentIds, searchTerm]
  );

  return (
    <div className={styles.searchableSelect} ref={ref}>
      <div className={styles.searchableSelectInputWrapper}>
        <Search size={16} className={styles.searchIcon} />
        <input
          className={styles.addInput}
          placeholder={placeholder}
          value={searchTerm}
          onChange={e=>setSearchTerm(e.target.value)}
          onFocus={()=>setIsOpen(true)}
          disabled={disabled}
        />
      </div>
      {isOpen && (
        <ul className={styles.optionsList}>
          {filtered.length
            ? filtered.map(opt => (
                <li key={opt.id} onMouseDown={() => { onSelect(opt.id); setSearchTerm(""); setIsOpen(false); }}>
                  {opt.name}
                </li>
              ))
            : <li className={styles.noOptions}>No results found</li>}
        </ul>
      )}
    </div>
  );
};

export default function FilterPreferences() {
  const { token } = useContext(AuthContext);

  const [filters, setFilters] = useState({ interested_subjects: [], languages_spoken: [], location: "" });
  const [options, setOptions] = useState({ subjects: [], languages: [], regions: [] });
  const [isLoading, setLoad] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const subjectMap  = useMemo(() => new Map(options.subjects.map(s => [s.id, s.name])), [options.subjects]);
  const languageMap = useMemo(() => new Map(options.languages.map(l => [l.id, l.name])), [options.languages]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoad(true); setError("");
      try {
        const [prefs, subjects, regions] = await Promise.all([
          apiClient.get("/users/preferences/", { headers: { Authorization: `Token ${token}` } }),
          apiClient.get("/subjects/"),
          apiClient.get("/feed/preferences/regions/")
        ]);
        setFilters(prefs.data);
        setOptions({
          subjects: subjects.data || [],
          languages: LANGUAGES.map(l => ({ id: l.code, name: l.name })),
          regions: regions.data || [],
        });
      } catch (e) {
        console.error(e);
        setError("Could not load your preferences.");
      } finally {
        setLoad(false);
      }
    };
    load();
  }, [token]);

  const update = useCallback(async (payload) => {
    setSaving(true);
    try {
      const { data } = await apiClient.patch("/users/preferences/", payload, {
        headers: { Authorization: `Token ${token}` }
      });
      setFilters(data);
    } finally {
      setSaving(false);
    }
  }, [token]);

  const addVal    = (key, v) => { if (!v || filters[key].includes(v)) return; update({ [key]: [...filters[key], key==="interested_subjects" ? parseInt(v,10) : v] }); };
  const removeVal = (key, v) => update({ [key]: filters[key].filter(x => x !== v) });
  const setLoc    = (e) => { const v = e.target.value; if (v !== filters.location) update({ location: v }); };

  if (isLoading) return <div className={styles.loadingState}><Loader size={24} className="animate-spin" /><p>Loading Filters...</p></div>;
  if (error)     return <div className={styles.errorState}><AlertCircle size={24} /><p>{error}</p></div>;

  const row = (label) => {
    const key = label === "Subjects" ? "interested_subjects" : "languages_spoken";
    const current = filters[key] || [];
    const list = label === "Subjects" ? options.subjects : options.languages;
    const map  = label === "Subjects" ? subjectMap : languageMap;
    const set  = new Set(current);
    return (
      <tr key={key}>
        <td className={styles.filterType}>{label}</td>
        <td>
          <div className={styles.filterChips}>
            {current.length
              ? current.map(id => <Chip key={id} label={map.get(id) || id} onRemove={() => removeVal(key, id)} />)
              : <em>None selected</em>}
          </div>
        </td>
        <td>
          <SearchableSelect
            placeholder={`+ Add ${label}...`}
            options={list}
            onSelect={id => addVal(key, id)}
            disabled={isSaving}
            currentIds={set}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className={isSaving ? styles.updatingOverlay : ""}>
      <div className={styles.panel}>
        <div className={styles.header}>Your Content Preferences</div>
        <p className={styles.description}>These settings personalize what you see across Zporta Academy.</p>
        <table className={styles.filterTable}>
          <thead><tr><th>Type</th><th>Your Selections</th><th>Add New</th></tr></thead>
          <tbody>
            {row("Subjects")}
            {row("Languages")}
            <tr>
              <td className={styles.filterType}>Location</td>
              <td colSpan="2">
                <select className={styles.locationSelect} value={filters.location || ""} onChange={setLoc} disabled={isSaving}>
                  <option value="">Select Location...</option>
                  {options.regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
