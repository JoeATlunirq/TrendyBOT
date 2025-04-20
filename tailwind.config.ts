import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				inter: ['Inter', 'sans-serif'],
				montserrat: ['Montserrat', 'sans-serif'],
				'roboto-mono': ['Roboto Mono', 'monospace'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				trendy: {
					brown: '#2E1D12', // Espresso brown
					'brown-light': '#3E2D22',
					'brown-dark': '#1E0D02',
					yellow: '#FDC40B', // Gold yellow
					'yellow-light': '#FDD54B',
					'yellow-dark': '#CB9A00',
					black: '#1A1A1A',
					white: '#F8F8F8',
				},
				figma_white_bg: '#FBFBF8',
				figma_hero_blue_start: '#1E80FF',
				figma_hero_blue_end: '#8ED0F2',
				figma_black_text: '#000000',
				figma_black_text_60: 'rgba(0, 0, 0, 0.6)',
				figma_white_text_95: 'rgba(255, 255, 255, 0.94)',
				figma_white_text_80: 'rgba(255, 255, 255, 0.8)',
				figma_white_text_70: 'rgba(255, 255, 255, 0.7)',
				figma_white_border: 'rgba(255, 255, 255, 0.59)',
				figma_black_btn_dark: '#232323',
				figma_black_btn_light: '#3C3C3C',
			},
			backgroundImage: {
				'hero-gradient': 'radial-gradient(circle at 52.5% 31.5%, #1E80FF 5.5%, #8ED0F2 78.5%)',
				'button-gradient': 'linear-gradient(to bottom, #3C3C3C, #232323)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'4xl': '2rem',
				'5xl': '2.5rem',
				'6xl': '3.125rem',
				'7xl': '3.75rem',
				'8xl': '4.5rem',
				'9xl': '5.625rem',
				'10xl': '6.25rem',
				'11xl': '7.5rem',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'pulse-slow': {
					'0%, 100%': {
						opacity: '1'
					},
					'50%': {
						opacity: '0.8'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.95)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'pulse-slow': 'pulse-slow 3s infinite ease-in-out',
				'scale-in': 'scale-in 0.2s ease-out'
			}
		}
	},
	plugins: [animate],
} satisfies Config;
