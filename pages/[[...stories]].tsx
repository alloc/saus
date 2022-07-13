import Link from 'next/link';
import Story from "../components/story";
import fetchAPI from '../api';
import type { IStory } from "../types";

interface StoriesData {
  page: number;
  type: string;
  stories: IStory[];
}

const mapStories = {
  top: "news",
  new: "newest",
  show: "show",
  ask: "ask",
  job: "jobs",
};

export async function getServerSideProps(context: any) {
  let page = +(context.query.page || 1);
  const type = context.params["*"] || "top";
  const stories = await fetchAPI(`${mapStories[type as keyof mapStories]}?page=${page}`)
  return {
    props: {
      page, type, stories
    }
  }
}

export default function Stories({ page, type, stories }: StoriesData) {

  return (
    <div className="news-view">
      <div className="news-list-nav">
        {page > 1 ? (
          <Link
            href={`/${type}?page=${page - 1}`}
            aria-label="Previous Page"
          >
            <a className="page-link">{"<"} prev</a>
          </Link>
        ) : (
          <span className="page-link disabled" aria-disabled="true">
            {"<"} prev
          </span>
        )}
        <span>page {page}</span>
        {stories && stories.length >= 29 ? (
          <Link
            href={`/${type}?page=${page + 1}`}
            aria-label="Next Page"
          >
            <a className="page-link">more {">"}</a>
          </Link>
        ) : (
          <span className="page-link disabled" aria-disabled="true">
            more {">"}
          </span>
        )}
      </div>
      <main className="news-list">
        {stories && (
          <ul>
            {stories.map((story) => (
              <Story key={story.id} story={story} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}