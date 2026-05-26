// Wrapper chuẩn hóa padding & max-width cho nội dung bên trong trang
import { cn } from '@/utils/cn'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
}

export default function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div className={cn('p-4 sm:p-6 max-w-screen-2xl mx-auto w-full', className)}>
      {children}
    </div>
  )
}
