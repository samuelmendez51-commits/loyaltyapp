export { default as middleware } from './src/proxy'

export const config = {
  matcher: [
    /*
     * Exclude assets, public files, and api routes from middleware.
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images/|assets/).*)',
  ],
}