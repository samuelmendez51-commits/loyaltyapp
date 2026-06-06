export { default as proxy } from './src/proxy'

export const config = {
  matcher: [
    /*
     * Exclude assets, public files, and api routes from proxy.
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images/|assets/).*)',
  ],
}
