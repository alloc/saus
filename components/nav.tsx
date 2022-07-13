import Link from 'next/link'

function Nav() {
  return (
    <header className="header">
      <nav className="inner">
        <Link href="/">
          <a><strong>HN</strong></a>
        </Link>
        <Link href="/new">
          <a><strong>New</strong></a>
        </Link>
        <Link href="/show">
          <a><strong>Show</strong></a>
        </Link>
        <Link href="/ask">
          <a><strong>Ask</strong></a>
        </Link>
        <Link href="/job">
          <a><strong>Jobs</strong></a>
        </Link>
        <a className="github" href="https://nextjs.org" target="_blank" rel="noreferrer">
          Built with Next
        </a>
      </nav>
    </header>
  );
}

export default Nav;
