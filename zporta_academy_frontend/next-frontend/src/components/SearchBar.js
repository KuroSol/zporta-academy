import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FaSearch } from 'react-icons/fa';
import apiClient from '@/api';
import styles from '@/styles/SearchBar.module.css';

export default function SearchBar({ placeholder = 'Search courses, lessons, quizzes, tags…' }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const [explorerRes, tagsRes] = await Promise.all([
          apiClient.get('/explorer/search/', { params: { q: query, limit: 8 } }),
          apiClient.get('/tags/', { params: { search: query, limit: 8 } }).catch(() => null)
        ]);
        const explorerData = explorerRes?.data || { courses: [], lessons: [], quizzes: [], guides: [], users: [] };
        const tagsData = tagsRes ? (Array.isArray(tagsRes.data) ? tagsRes.data : (tagsRes.data?.results || [])) : [];
        setResults({ ...explorerData, tags: tagsData });
      } catch (err) {
        console.error('SearchBar error:', err.message);
        setResults({ courses: [], lessons: [], quizzes: [], guides: [], users: [], tags: [] });
      } finally { setBusy(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const hasAny = results && Object.values(results).some(arr => Array.isArray(arr) && arr.length > 0);

  return (
    <div className={styles.searchBar}>
      <FaSearch className={styles.searchIcon} />
      <input
        className={styles.searchInput}
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Global search"
      />
      {query.trim() && (
        <div className={styles.searchDropdown}>
          {busy && <div className={styles.status}>Searching…</div>}
          {!busy && !hasAny && <div className={styles.status}>No results for {query}</div>}
          {!busy && hasAny && Object.entries(results).map(([group, items]) => (
            items && items.length > 0 ? <SearchGroup key={group} title={group} items={items} /> : null
          ))}
        </div>
      )}
    </div>
  );
}

function SearchGroup({ title, items }) {
  const makeHref = (item) => {
    const type = title.toLowerCase();
    switch (type) {
      case 'quizzes': return item.permalink ? `/quizzes/${item.permalink}` : '#';
      case 'guides': case 'users': return item.username ? `/guide/${item.username}` : '#';
      case 'tags': return item.slug ? `/tags/${item.slug}` : '#';
      default: return `/${type}/${item.permalink || item.id}`;
    }
  };
  const seeAllHref = () => {
    const type = title.toLowerCase();
    if (type === 'tags') return '/tags';
    if (type === 'users' || type === 'guides') return '/explorer';
    return `/learn?tab=${type}`;
  };
  return (
    <div className={styles.searchBlock}>
      <div className={styles.searchBlockHeaderRow}>
        <h4 className={styles.searchBlockHeader}>{title} ({items.length})</h4>
        <Link href={seeAllHref()} className={styles.seeAllLink}>See all</Link>
      </div>
      <ul className={styles.searchBlockList}>
        {items.slice(0,8).map(item => (
          <li key={`${title}-${item.id || item.slug || item.username}`}>
            <Link href={makeHref(item)} className={styles.searchBlockLink}>
              <span className={styles.typeBadge}>{title}</span>
              <span>{item.title || item.name || item.full_name || item.username || `Item #${item.id}`}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
