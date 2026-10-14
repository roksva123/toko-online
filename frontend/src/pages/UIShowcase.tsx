import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card'
import { Skeleton, CardSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { Tabs } from '@/components/ui/Tabs'
import { Pagination } from '@/components/ui/Pagination'

export default function UIShowcase() {
  const [quantity, setQuantity] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  return (
    <>
      <Helmet>
        <title>UI Components Showcase - Dev Only</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-2">UI Components Showcase</h1>
        <p className="text-gray-600 mb-12">Dev-only page to view all components (localhost:5173/_ui)</p>

        {/* Buttons */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Buttons</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="primary">Small</Button>
              <Button size="md" variant="primary">Medium</Button>
              <Button size="lg" variant="primary">Large</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled</Button>
              <Button isLoading>Loading</Button>
              <Button fullWidth>Full Width</Button>
            </div>
          </div>
        </section>

        {/* Inputs & Forms */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Form Elements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Email" type="email" placeholder="user@example.com" />
            <Input label="With Error" error="Email tidak valid" />
            <Textarea label="Message" placeholder="Tulis pesan..." />
            <Select
              label="Kategori"
              options={[
                { value: '1', label: 'Elektronik' },
                { value: '2', label: 'Fashion' },
                { value: '3', label: 'Rumah' },
              ]}
            />
            <div className="space-y-2">
              <Checkbox label="Setuju dengan syarat" />
              <Checkbox label="Disabled" disabled />
            </div>
          </div>
        </section>

        {/* Badges & Status */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Badges & Status</h2>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="danger">Danger</Badge>
            <Badge variant="info">Info</Badge>
            <StatusBadge status="pending_payment" />
            <StatusBadge status="processing" />
            <StatusBadge status="shipped" />
            <StatusBadge status="delivered" />
            <StatusBadge status="cancelled" />
          </div>
        </section>

        {/* Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>Card Header</CardHeader>
              <CardBody>This is card body content</CardBody>
              <CardFooter>Card Footer</CardFooter>
            </Card>
            <Card variant="bordered">
              <CardBody>Bordered card with padding</CardBody>
            </Card>
          </div>
        </section>

        {/* Loading States */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Loading States</h2>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 mb-3">Spinner</p>
              <Spinner />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-3">Skeleton</p>
              <Skeleton className="w-full h-12 mb-2" />
              <Skeleton className="w-3/4 h-4" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-3">Card Skeleton</p>
              <CardSkeleton />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-3">Product Grid Skeleton</p>
              <ProductGridSkeleton />
            </div>
          </div>
        </section>

        {/* Modal */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Modal</h2>
          <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Example Modal"
            size="md"
            footer={
              <>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary">Save</Button>
              </>
            }
          >
            <p>This is modal content</p>
          </Modal>
        </section>

        {/* Breadcrumb */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Breadcrumb</h2>
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Products', href: '/products' },
              { label: 'Electronics', isActive: true },
            ]}
          />
        </section>

        {/* QuantityStepper */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Quantity Stepper</h2>
          <div className="flex gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-3">Default</p>
              <QuantityStepper value={quantity} onChange={setQuantity} />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-3">Disabled</p>
              <QuantityStepper value={5} onChange={() => {}} disabled />
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Tabs</h2>
          <Tabs
            tabs={[
              { id: 'tab1', label: 'Tab 1', content: <p>Content for tab 1</p> },
              { id: 'tab2', label: 'Tab 2', content: <p>Content for tab 2</p> },
              { id: 'tab3', label: 'Tab 3', content: <p>Content for tab 3</p> },
            ]}
          />
        </section>

        {/* Pagination */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Pagination</h2>
          <Pagination currentPage={currentPage} totalPages={10} onPageChange={setCurrentPage} />
        </section>

        {/* Empty & Error States */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Empty & Error States</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardBody>
                <EmptyState
                  icon="🛒"
                  title="Keranjang Kosong"
                  description="Belum ada produk di keranjang. Mulai belanja sekarang!"
                  action={<Button size="sm" variant="primary">Belanja Sekarang</Button>}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <ErrorState
                  icon="⚠️"
                  title="Terjadi Kesalahan"
                  message="Gagal memuat produk. Silakan coba lagi."
                  action={<Button size="sm" variant="primary">Coba Lagi</Button>}
                />
              </CardBody>
            </Card>
          </div>
        </section>
      </div>
    </>
  )
}
