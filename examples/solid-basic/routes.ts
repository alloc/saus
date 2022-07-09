import { route } from 'saus'

route('/', () => import('./pages/index'))
route('/about', () => import('./pages/about'))
