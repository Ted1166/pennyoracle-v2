import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { config } from './config'
import App from './App'

const queryClient = new QueryClient()

const theme = darkTheme({
  accentColor: '#B5652E',
  accentColorForeground: '#F1E8DC',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'small',
})

theme.colors.modalBackground = '#1A1726'
theme.colors.profileForeground = '#1A1726'
theme.fonts.body = "'Sora', ui-sans-serif, sans-serif"

export default function Root() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
