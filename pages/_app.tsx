import './bsn.css'
import './app.scss'
import Layout from '../components/Layout'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useEffect } from 'react'

export default function MyApp({ Component, pageProps }) {
  
  console.log('%cHey, are you trying to figure out how something works?\nView the source at https://github.com/joshhills/steam-review-explorer',
    'color: #007bff; font-size: .75rem; padding: 2px; border-radius:2px')

  const router = useRouter()

  // GitHub Pages serves 404.html for deep links like /game/<appId>?start=...; pages/404.tsx
  // re-encodes them as /?/game/<appId>&start=...~and~end=... Decode the whole query string
  // (not just the first router.query key, which holds only the path) and restore the original URL.
  useEffect(() => {
    const { search, hash } = window.location
    if (search[1] === '/') {
      const decoded = search.slice(1).split('&').map((s) => s.replace(/~and~/g, '&')).join('?')
      router.replace(decoded + hash)
    }
  }, [])

  return (<>
    <Head>
      <title>Steam Review Explorer</title>
      <meta name="viewport" content="width=device-width,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
    </Head>
    <Layout>
        <Component {...pageProps} />
    </Layout>
  </>)
}