import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Badge, Button, EmptyState, ErrorState, Input, Modal, Pagination, Select, Skeleton, } from '@/components/ui';
import { adminKeys, categoryOptions, deleteProduct, fetchCategories, fetchProducts, formatRupiah, parseApiError, } from '@/lib/api/admin';
import { ProductForm } from '../components/ProductForm';
const PAGE_SIZE = 20;
const statusOptions = [
    { value: 'active', label: 'Aktif' },
    { value: 'inactive', label: 'Nonaktif' },
];
function priceLabel(p) {
    if (p.variant_count === 0)
        return '-';
    if (p.price_min === p.price_max)
        return formatRupiah(p.price_min);
    return `${formatRupiah(p.price_min)} - ${formatRupiah(p.price_max)}`;
}
export default function AdminProducts() {
    const queryClient = useQueryClient();
    const [view, setView] = useState({ mode: 'list' });
    const [notice, setNotice] = useState('');
    // Filter
    const [searchInput, setSearchInput] = useState('');
    const [q, setQ] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    // Hapus
    const [deleting, setDeleting] = useState(null);
    const [deleteError, setDeleteError] = useState('');
    const [deleteBusy, setDeleteBusy] = useState(false);
    // Pencarian menunggu admin berhenti mengetik sebentar
    useEffect(() => {
        const t = setTimeout(() => {
            setQ(searchInput.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);
    useEffect(() => {
        if (!notice)
            return;
        const t = setTimeout(() => setNotice(''), 4000);
        return () => clearTimeout(t);
    }, [notice]);
    const { data: categories } = useQuery({
        queryKey: adminKeys.categories,
        queryFn: fetchCategories,
    });
    const categoryFilterOptions = useMemo(() => categoryOptions(categories ?? []), [categories]);
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: [...adminKeys.products, 'list', { page, q, categoryId, status }],
        queryFn: () => fetchProducts({
            page,
            limit: PAGE_SIZE,
            q,
            category_id: categoryId,
            status,
        }),
        enabled: view.mode === 'list',
    });
    const items = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const hasFilter = q !== '' || categoryId !== '' || status !== '';
    const handleDelete = async () => {
        if (!deleting)
            return;
        setDeleteError('');
        setDeleteBusy(true);
        try {
            await deleteProduct(deleting.id);
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            setDeleting(null);
            setNotice('Produk berhasil dihapus');
        }
        catch (err) {
            setDeleteError(parseApiError(err).message);
        }
        finally {
            setDeleteBusy(false);
        }
    };
    if (view.mode === 'form') {
        return (_jsxs(_Fragment, { children: [_jsx(Helmet, { children: _jsxs("title", { children: [view.productId ? 'Ubah produk' : 'Tambah produk', " - Admin Toko Online"] }) }), _jsx(ProductForm, { productId: view.productId, onCancel: () => setView({ mode: 'list' }), onSaved: (message) => {
                        setNotice(message);
                        setView({ mode: 'list' });
                    } })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(Helmet, { children: _jsx("title", { children: "Produk - Admin Toko Online" }) }), _jsxs("div", { className: "flex items-center justify-between gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Produk" }), _jsx("p", { className: "text-gray-600 text-sm mt-1", children: total > 0 ? `${total} produk` : 'Kelola produk yang dijual di toko.' })] }), _jsx(Button, { onClick: () => setView({ mode: 'form', productId: null }), children: "Tambah produk" })] }), notice && (_jsx("div", { role: "status", className: "mb-4 rounded border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800", children: notice })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3 mb-4", children: [_jsx(Input, { label: "Cari produk", placeholder: "Ketik nama produk", value: searchInput, onChange: (e) => setSearchInput(e.target.value) }), _jsx(Select, { label: "Kategori", value: categoryId, onChange: (e) => {
                            setCategoryId(e.target.value);
                            setPage(1);
                        }, options: categoryFilterOptions }), _jsx(Select, { label: "Status", value: status, onChange: (e) => {
                            setStatus(e.target.value);
                            setPage(1);
                        }, options: statusOptions })] }), isLoading && (_jsx("div", { className: "space-y-2", children: _jsx(Skeleton, { className: "h-14 w-full", count: 6 }) })), isError && (_jsx(ErrorState, { title: "Produk gagal dimuat", message: "Periksa koneksi lalu coba lagi.", action: _jsx(Button, { onClick: () => refetch(), children: "Coba lagi" }) })), !isLoading && !isError && items.length === 0 && (_jsx(EmptyState, { title: hasFilter ? 'Produk tidak ditemukan' : 'Belum ada produk', description: hasFilter
                    ? 'Coba ubah kata kunci atau filter.'
                    : 'Tambahkan produk pertama agar muncul di toko.', action: hasFilter ? (_jsx(Button, { variant: "secondary", onClick: () => {
                        setSearchInput('');
                        setCategoryId('');
                        setStatus('');
                        setPage(1);
                    }, children: "Reset filter" })) : (_jsx(Button, { onClick: () => setView({ mode: 'form', productId: null }), children: "Tambah produk" })) })), !isLoading && !isError && items.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: "bg-white rounded-lg border border-gray-200 overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm text-left", children: [_jsx("thead", { className: "bg-gray-50 text-gray-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Produk" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Kategori" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Harga" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Stok" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Varian" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Aksi" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: items.map((p) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-4 py-3", children: [_jsx("span", { className: "font-medium text-gray-900", children: p.name }), _jsx("span", { className: "block text-xs text-gray-500", children: p.slug })] }), _jsx("td", { className: "px-4 py-3 text-gray-600", children: p.category_name }), _jsx("td", { className: "px-4 py-3 text-gray-900 whitespace-nowrap", children: priceLabel(p) }), _jsx("td", { className: "px-4 py-3 text-gray-600", children: p.total_stock === 0 ? (_jsx(Badge, { variant: "danger", children: "Habis" })) : (p.total_stock) }), _jsx("td", { className: "px-4 py-3 text-gray-600", children: p.variant_count }), _jsx("td", { className: "px-4 py-3", children: _jsx(Badge, { variant: p.is_active ? 'success' : 'default', children: p.is_active ? 'Aktif' : 'Nonaktif' }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => setView({ mode: 'form', productId: p.id }), children: "Ubah" }), _jsx(Button, { variant: "danger", size: "sm", onClick: () => {
                                                                setDeleteError('');
                                                                setDeleting(p);
                                                            }, children: "Hapus" })] }) })] }, p.id))) })] }) }), totalPages > 1 && (_jsx(Pagination, { className: "mt-6", currentPage: page, totalPages: totalPages, onPageChange: setPage }))] })), _jsxs(Modal, { isOpen: deleting !== null, onClose: () => !deleteBusy && setDeleting(null), title: "Hapus produk", size: "sm", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", onClick: () => setDeleting(null), disabled: deleteBusy, children: "Batal" }), _jsx(Button, { variant: "danger", onClick: handleDelete, isLoading: deleteBusy, children: "Hapus" })] }), children: [_jsxs("p", { className: "text-gray-700", children: ["Hapus produk ", _jsx("strong", { children: deleting?.name }), " beserta semua variannya? Tindakan ini tidak bisa dibatalkan."] }), deleteError && (_jsx("div", { role: "alert", className: "mt-3 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700", children: deleteError }))] })] }));
}
//# sourceMappingURL=AdminProducts.js.map