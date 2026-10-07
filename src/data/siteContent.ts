import type { Accommodation } from '../types'

export const accommodation: Accommodation[] = [
  {
    id: 'kanlungan-cabin',
    name: 'Kanlungan Cabin',
    shortDescription: 'A private bamboo cabin for a quieter stay close to nature.',
    capacity: 2,
    priceLabel: 'Rate confirmed with your booking request',
    features: ['2 guests', '22-hour stay', 'Breakfast', 'Kapeng Barako', 'Private cabin'],
    image: '/images/cabin-interior.webp',
  },
]

export const activities = [
  { title: 'River exploration', text: 'Spend part of the day following the water and exploring the natural surroundings.' },
  { title: 'Horseback riding', text: 'A slower way to take in the landscape beyond the cabin.' },
  { title: 'Farm-life experience', text: 'Reconnect with the simple rhythm of provincial life.' },
]

export const faq = [
  { q: 'What is included?', a: 'The current public listing describes a 22-hour stay with breakfast, unlimited Kapeng Barako, beddings, towels, toiletries, access to games and bonfire areas, and a cooking area.' },
  { q: 'How do I book?', a: 'Choose your preferred dates and guest count, add your contact details, then send a booking request. The Malaya team can confirm the reservation from the admin panel.' },
  { q: 'Can I bring pets?', a: 'Yes. The current public listing describes the cabin as pet-friendly.' },
  { q: 'Can I talk to a person?', a: 'Yes. Start here with the assistant, then choose “Talk to staff”. The conversation is recorded so a team member can continue it.' },
]

export const dailyMessage = 'A slower stay, a bamboo cabin, and more time outdoors.'
