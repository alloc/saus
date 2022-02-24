import { route } from 'saus'
import './html'

route('/', () => import('../pages/Home'))

route(() => import('../pages/NotFound'))
