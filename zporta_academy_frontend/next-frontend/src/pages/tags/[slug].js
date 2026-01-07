import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import apiClient from "@/api";
import styles from "@/styles/TagPage.module.css";
import { FaSearch } from "react-icons/fa";

export async function getServerSideProps({ params, req }) {
  const { slug } = params;

  try {
    const res = await apiClient.get(`/tags/${slug}/`, {
      headers: { cookie: req?.headers?.cookie || "" },
    });

    const tag = res.data;
    const acceptLang = req?.headers?.["accept-language"] || "en-US";
    const primaryLang = Array.isArray(acceptLang)
      ? acceptLang[0]
      : acceptLang.split(",")[0];
    const ogLocale = (primaryLang || "en-US").replace("-", "_");

    return {
      props: { tag, ogLocale, primaryLang },
    };
  } catch (error) {
    console.error("SSR tag fetch error:", error.message);
    return { notFound: true };
  }
}

const formatDate = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function TagPage({
  tag,
  ogLocale = "en_US",
  primaryLang = "en-US",
}) {
  // Normalize origin (strip trailing slash and www)
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://zportaacademy.com")
    .replace(/\/$/, "")
    .replace("www.", "");
  // Canonical policy: enforce trailing slash for consistency with backend canonical_url helper
  const canonical = `${site}/tags/${tag.slug}/`;
  const title = `${tag.name} – Tagged Content | Zporta Academy`;
  const desc =
    tag.description ||
    `Browse all content tagged with ${tag.name} on Zporta Academy`;
  const keywords = [
    tag.name,
    "tags",
    "Zporta Academy",
    "courses",
    "lessons",
    "quizzes",
    "learning",
  ].join(", ");
  const posts = tag.posts?.results || [];
  const totalPosts = tag.posts?.count || 0;
  const lessons = tag.lessons?.results || [];
  const totalLessons = tag.lessons?.count || 0;
  const courses = tag.courses?.results || [];
  const totalCourses = tag.courses?.count || 0;
  const quizzes = tag.quizzes?.results || [];
  const totalQuizzes = tag.quizzes?.count || 0;

  // Global search (reuse explorer search)
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [explorerRes, tagsRes] = await Promise.all([
          apiClient.get("/explorer/search/", {
            params: { q: searchTerm, limit: 8 },
          }),
          apiClient
            .get("/tags/", { params: { search: searchTerm, limit: 8 } })
            .catch(() => null),
        ]);
        const explorerData = explorerRes?.data || {
          courses: [],
          lessons: [],
          quizzes: [],
          guides: [],
          users: [],
        };
        const tagsData = tagsRes
          ? Array.isArray(tagsRes.data)
            ? tagsRes.data
            : tagsRes.data?.results || []
          : [];
        setSearchResults({ ...explorerData, tags: tagsData });
      } catch (err) {
        console.error("Tag page search error:", err.message);
        setSearchResults({
          courses: [],
          lessons: [],
          quizzes: [],
          guides: [],
          users: [],
          tags: [],
        });
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta name="keywords" content={keywords} />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content="index,follow" />
        <meta name="language" content={primaryLang} />
        <meta httpEquiv="content-language" content={primaryLang} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:image" content={`${site}/images/default-og.png`} />
        <meta property="og:image:alt" content={`Cover image for ${tag.name}`} />
        <meta property="og:site_name" content="Zporta Academy" />
        <meta property="og:locale" content={ogLocale} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={`${site}/images/default-og.png`} />
        <meta name="twitter:site" content="@ZportaAcademy" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: `#${tag.name} – Zporta Academy`,
              description: desc,
              inLanguage: primaryLang,
              url: canonical,
              isPartOf: {
                "@type": "WebSite",
                name: "Zporta Academy",
                url: site,
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${site}/explorer?q={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              },
              about: { "@type": "Thing", name: tag.name, url: canonical },
              breadcrumb: {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Tags",
                    item: `${site}/tags`,
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: tag.name,
                    item: canonical,
                  },
                ],
              },
              mainEntity: [
                {
                  "@type": "ItemList",
                  name: "Posts",
                  numberOfItems: totalPosts,
                  itemListElement: (posts || []).slice(0, 10).map((p, i) => ({
                    "@type": "Article",
                    position: i + 1,
                    name: p.title,
                    url: p.permalink ? `${site}/posts/${p.permalink}` : canonical,
                    datePublished: p.published_at,
                  })),
                },
                {
                  "@type": "ItemList",
                  name: "Lessons",
                  numberOfItems: totalLessons,
                  itemListElement: (lessons || []).slice(0, 10).map((l, i) => ({
                    "@type": "CreativeWork",
                    position: i + 1,
                    name: l.title,
                    url: l.permalink ? `${site}/lessons/${l.permalink}` : canonical,
                    dateCreated: l.created_at,
                  })),
                },
                {
                  "@type": "ItemList",
                  name: "Courses",
                  numberOfItems: totalCourses,
                  itemListElement: (courses || []).slice(0, 10).map((c, i) => ({
                    "@type": "Course",
                    position: i + 1,
                    name: c.title,
                    url: c.permalink ? `${site}/courses/${c.permalink}` : canonical,
                    dateCreated: c.created_at,
                  })),
                },
                {
                  "@type": "ItemList",
                  name: "Quizzes",
                  numberOfItems: totalQuizzes,
                  itemListElement: (quizzes || []).slice(0, 10).map((q, i) => ({
                    "@type": "CreativeWork",
                    position: i + 1,
                    name: q.title,
                    url: q.permalink ? `${site}/quizzes/${q.permalink}` : canonical,
                    dateCreated: q.created_at,
                  })),
                },
              ],
            }),
          }}
        />
      </Head>

      <div className={styles.pageWrapper}>
        <main className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.mainHeading}>#{tag.name}</h1>
            {tag.description && (
              <p className={styles.subheading}>{tag.description}</p>
            )}
            <div className={styles.topRow}>
              <div className={styles.chips}>
                <Link href="#posts" className={styles.chip}>
                  <span>{totalPosts}</span>{" "}
                  <span>{totalPosts === 1 ? "post" : "posts"}</span>
                </Link>
                <Link href="#lessons" className={styles.chip}>
                  <span>{totalLessons}</span>{" "}
                  <span>{totalLessons === 1 ? "lesson" : "lessons"}</span>
                </Link>
                <Link href="#courses" className={styles.chip}>
                  <span>{totalCourses}</span>{" "}
                  <span>{totalCourses === 1 ? "course" : "courses"}</span>
                </Link>
                <Link href="#quizzes" className={styles.chip}>
                  <span>{totalQuizzes}</span>{" "}
                  <span>{totalQuizzes === 1 ? "quiz" : "quizzes"}</span>
                </Link>
              </div>
              <div className={styles.searchBar}>
                <FaSearch className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search courses, lessons, quizzes…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm.trim() && (
                  <div className={styles.searchDropdown}>
                    {isSearching ? (
                      <div className={styles.statusContainer}>Searching…</div>
                    ) : (
                      searchResults &&
                      Object.entries(searchResults).map(([category, items]) =>
                        items && items.length > 0 ? (
                          <SearchBlock
                            key={category}
                            title={category}
                            items={items}
                          />
                        ) : null
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Posts Section */}
          <section id="posts">
            <h2 className={styles.sectionTitle}>Posts</h2>
            {posts.length === 0 ? (
              <div className={styles.statusContainer}>
                <p>No posts found with this tag.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {posts.map((p) => (
                  <Link
                    key={p.id}
                    href={p.permalink ? `/posts/${p.permalink}` : "#"}
                    className={styles.card}
                  >
                    <div className={styles.media}>
                      {p.cover_image_url ? (
                        <img
                          src={p.cover_image_url}
                          alt={p.title}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src =
                              "https://placehold.co/800x600/4a5568/ffffff?text=Image";
                          }}
                        />
                      ) : (
                        <div className={styles.placeholder}>Z</div>
                      )}
                    </div>
                    <div className={styles.body}>
                      <h3 className={styles.title}>{p.title || "Untitled"}</h3>
                      {p.excerpt && (
                        <p className={styles.excerpt}>{p.excerpt}</p>
                      )}
                      <div className={styles.meta}>
                        <span className={styles.author}>{p.created_by}</span>
                        <span className={styles.dot}>•</span>
                        <time className={styles.date}>
                          {formatDate(p.published_at)}
                        </time>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Lessons Section */}
          <section id="lessons">
            <h2 className={styles.sectionTitle}>Lessons</h2>
            {lessons.length === 0 ? (
              <div className={styles.statusContainer}>
                <p>No lessons found with this tag.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {lessons.map((l) => (
                  <Link
                    key={l.id}
                    href={l.permalink ? `/lessons/${l.permalink}` : "#"}
                    className={styles.card}
                  >
                    <div className={styles.body}>
                      <h3 className={styles.title}>
                        {l.title || "Untitled lesson"}
                      </h3>
                      <div className={styles.meta}>
                        <span className={styles.author}>
                          {l.course_title || "Lesson"}
                        </span>
                        <span className={styles.dot}>•</span>
                        <time className={styles.date}>
                          {formatDate(l.created_at)}
                        </time>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Courses Section */}
          <section id="courses">
            <h2 className={styles.sectionTitle}>Courses</h2>
            {courses.length === 0 ? (
              <div className={styles.statusContainer}>
                <p>No courses found with this tag.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {courses.map((c) => (
                  <Link
                    key={c.id}
                    href={c.permalink ? `/courses/${c.permalink}` : "#"}
                    className={styles.card}
                  >
                    <div className={styles.body}>
                      <h3 className={styles.title}>
                        {c.title || "Untitled course"}
                      </h3>
                      <div className={styles.meta}>
                        <span className={styles.author}>
                          {c.subject_name || "Course"}
                        </span>
                        <span className={styles.dot}>•</span>
                        <time className={styles.date}>
                          {formatDate(c.created_at)}
                        </time>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Quizzes Section */}
          <section id="quizzes">
            <h2 className={styles.sectionTitle}>Quizzes</h2>
            {quizzes.length === 0 ? (
              <div className={styles.statusContainer}>
                <p>No quizzes found with this tag.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {quizzes.map((q) => (
                  <Link
                    key={q.id}
                    href={q.permalink ? `/quizzes/${q.permalink}` : "#"}
                    className={styles.card}
                  >
                    <div className={styles.body}>
                      <h3 className={styles.title}>
                        {q.title || "Untitled quiz"}
                      </h3>
                      <div className={styles.meta}>
                        <span className={styles.author}>
                          {q.subject_name || "Quiz"}
                        </span>
                        <span className={styles.dot}>•</span>
                        <time className={styles.date}>
                          {formatDate(q.created_at)}
                        </time>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

// Simple search block reused from homepage
function SearchBlock({ title, items }) {
  const makeHref = (item) => {
    const type = title.toLowerCase();
    switch (type) {
      case "quizzes":
        return item.permalink ? `/quizzes/${item.permalink}` : "#";
      case "guides":
      case "users":
        return item.username ? `/guide/${item.username}` : "#";
      case "tags":
        return item.slug ? `/tags/${item.slug}` : "#";
      default:
        return `/${type}/${item.permalink || item.id}`;
    }
  };
  const seeAllHref = () => {
    const type = title.toLowerCase();
    if (type === "tags") return "/tags";
    if (type === "users" || type === "guides") return "/explorer";
    return `/learn?tab=${type}`;
  };
  return (
    <div className={styles.searchBlock}>
      <div className={styles.searchBlockHeaderRow}>
        <h4 className={styles.searchBlockHeader}>
          {title} ({items.length})
        </h4>
        <Link href={seeAllHref()} className={styles.seeAllLink}>
          See all
        </Link>
      </div>
      <ul className={styles.searchBlockList}>
        {items.slice(0, 8).map((item) => (
          <li key={`${title}-${item.id}`}>
            <Link href={makeHref(item)} className={styles.searchBlockLink}>
              <span className={styles.typeBadge}>{title}</span>
              <span>
                {item.title ||
                  item.name ||
                  item.full_name ||
                  item.username ||
                  `Item #${item.id}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
