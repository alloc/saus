import Link from 'next/link';

import type { IStory } from "../types";

const Story = (props: { story: IStory }) => {
  return (
    <li className="news-item">
      <span className="score">{props.story.points}</span>
      <span className="title">
        {props.story.url && !props.story.url.startsWith("item?id=") ? (
          <>
            <a href={props.story.url} target="_blank" rel="noreferrer">
              {props.story.title}
            </a>
            <span className="host"> ({props.story.domain})</span>
          </>
        ) : (
          <Link href={`/item/${props.story.id}`}><a>{props.story.title}</a></Link>
        )}
      </span>
      <br />
      <span className="meta">
        {props.story.type !== "job" ? (
          <>
            by <Link href={`/users/${props.story.user}`}><a>{props.story.user}</a></Link>{" "}
            {props.story.time_ago} |{" "}
            <Link href={`/stories/${props.story.id}`}>
              {props.story.comments_count
                ? `${props.story.comments_count} comments`
                : "discuss"}
            </Link>
          </>
        ) : (
          <Link href={`/stories/${props.story.id}`}><a>{props.story.time_ago}</a></Link>
        )}
      </span>
      {props.story.type !== "link" && (
        <>
          {" "}
          <span className="label">{props.story.type}</span>
        </>
      )}
    </li>
  );
};

export default Story;
