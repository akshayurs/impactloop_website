import { render, screen } from '@testing-library/react'
import { Nav } from '@/components/nav'
import { ThemeProvider } from '@/components/theme-provider'

render(
  <ThemeProvider>
    <Nav />
  </ThemeProvider>,
)

const buttons = screen.queryAllByRole('button')
console.log('Total buttons:', buttons.length)
buttons.forEach((btn, i) => {
  console.log(`Button ${i}:`, btn.getAttribute('aria-label'))
})
