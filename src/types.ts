export type Accommodation = {
  id: string
  name: string
  shortDescription: string
  capacity: number
  priceLabel: string
  features: string[]
  image: string
}

export type BookingDraft = {
  accommodationId: string
  checkIn: string
  checkOut: string
  guests: number
  fullName: string
  email: string
  phone: string
  preferredArrival: string
  notes: string
}

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'completed'

export type SiteReview = {
  id: string
  full_name: string
  rating: number
  review_text: string
  photo_data: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export type SupportMessage = {
  id: string
  sender: 'visitor' | 'bot' | 'staff'
  text: string
  createdAt: string
}

export type SupportConversation = {
  id: string
  visitorName: string
  visitorEmail: string
  visitorPhone: string
  mode: 'bot' | 'staff'
  status: 'open' | 'closed'
  messages: SupportMessage[]
  updatedAt: string
}
