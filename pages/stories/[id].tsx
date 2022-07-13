import Link from "next/link";
import type { IStory } from "../../types";
import Comment from "../../components/comment";
import fetchAPI from "../../api";

export async function getServerSideProps(context: any) {
  const story = await fetchAPI(`item/${context.params.id}`)
  return {
    props: { story }
  }
}


const Story = ({ story }: { story: IStory }) => {
  return (
    story && (
      <div className="item-view">
        <div className="item-view-header">
          <a href={story.url} target="_blank" rel="noreferrer">
            <h1>{story.title}</h1>
          </a>
          {story.domain && <span className="host">({story.domain})</span>}
          <p className="meta">
            {story.points} points | by{" "}
            <Link href={`/users/${story.user}`}><a>{story.user}</a></Link>{" "}
            {story.time_ago} ago
          </p>
        </div>
        <div className="item-view-comments">
          <p className="item-view-comments-header">
            {story.comments_count
              ? story.comments_count + " comments"
              : "No comments yet."}
          </p>
          <ul className="comment-children">
            {story.comments.map((comment) => (
              <Comment key={comment.id} comment={comment} />
            ))}
          </ul>
        </div>
      </div>
    )
  );
};

export default Story;
