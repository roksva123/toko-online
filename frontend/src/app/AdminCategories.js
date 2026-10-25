import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Badge, Button, Checkbox, EmptyState, ErrorState, Input, Modal, Select, Skeleton, } from '@/components/ui';
import { adminKeys, categoryOptions, createCategory, deleteCategory, descendantIds, fetchCategories, flattenCategories, parseApiError, updateCategory, } from '@/lib/api/admin';
const emptyForm = {
    name: '',
    parent_id: '',
    slug: '',
    sort_order: '0',
    is_active: true,
};
export default function AdminCategories() {
    const queryClient = useQueryClient();
    const { data: categories, isLoading, isError, refetch, } = useQuery({
        queryKey: adminKeys.categories,
        queryFn: fetchCategories,
    });
    const [notice, setNotice] = useState('');
    // Form tambah / ubah
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    // Konfirmasi hapus
    const [deleting, setDeleting] = useState(null);
    const [deleteError, setDeleteError] = useState('');
    const [deleteBusy, setDeleteBusy] = useState(false);
    useEffect(() => {
        if (!notice)
            return;
        const t = setTimeout(() => setNotice(''), 4000);
        return () => clearTimeout(t);
    }, [notice]);
    const rows = useMemo(() => flattenCategories(categories ?? []), [categories]);
    // Induk tidak boleh dirinya sendiri atau turunannya
    const parentOptions = useMemo(() => {
        const list = categories ?? [];
        const exclude = editing
            ? new Set([editing.id, ...descendantIds(list, editing.id)])
            : undefined;
        return categoryOptions(list, exclude);
    }, [categories, editing]);
    const parentName = (id) => id ? categories?.find((c) => c.id === id)?.name : undefined;
    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setFieldErrors({});
        setFormError('');
        setIsFormOpen(true);
    };
    const openEdit = (cat) => {
        setEditing(cat);
        setForm({
            name: cat.name,
            parent_id: cat.parent_id ?? '',
            slug: cat.slug,
            sort_order: String(cat.sort_order),
            is_active: cat.is_active,
        });
        setFieldErrors({});
        setFormError('');
        setIsFormOpen(true);
    };
    const closeForm = () => {
        if (saving)
            return;
        setIsFormOpen(false);
    };
    const setField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (fieldErrors[key]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        const errors = {};
        if (form.name.trim().length < 2)
            errors.name = 'Nama kategori minimal 2 karakter';
        const sortOrder = Number(form.sort_order === '' ? 0 : form.sort_order);
        if (!Number.isInteger(sortOrder) || sortOrder < 0) {
            errors.sort_order = 'Urutan harus bilangan bulat 0 atau lebih';
        }
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0)
            return;
        const payload = {
            parent_id: form.parent_id || null,
            name: form.name.trim(),
            slug: form.slug.trim(),
            sort_order: sortOrder,
            is_active: form.is_active,
        };
        setSaving(true);
        try {
            if (editing) {
                await updateCategory(editing.id, payload);
            }
            else {
                await createCategory(payload);
            }
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            setIsFormOpen(false);
            setNotice(editing ? 'Kategori berhasil diperbarui' : 'Kategori berhasil ditambahkan');
        }
        catch (err) {
            const feedback = parseApiError(err);
            setFieldErrors(feedback.fields);
            if (Object.keys(feedback.fields).length === 0)
                setFormError(feedback.message);
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async () => {
        if (!deleting)
            return;
        setDeleteError('');
        setDeleteBusy(true);
        try {
            await deleteCategory(deleting.id);
            await queryClient.invalidateQueries({ queryKey: adminKeys.all });
            setDeleting(null);
            setNotice('Kategori berhasil dihapus');
        }
        catch (err) {
            setDeleteError(parseApiError(err).message);
        }
        finally {
            setDeleteBusy(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx(Helmet, { children: _jsx("title", { children: "Kategori - Admin Toko Online" }) }), _jsxs("div", { className: "flex items-center justify-between gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Kategori" }), _jsx("p", { className: "text-gray-600 text-sm mt-1", children: "Kelompokkan produk agar mudah dicari pembeli." })] }), _jsx(Button, { onClick: openCreate, children: "Tambah kategori" })] }), notice && (_jsx("div", { role: "status", className: "mb-4 rounded border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800", children: notice })), isLoading && (_jsx("div", { className: "space-y-2", children: _jsx(Skeleton, { className: "h-12 w-full", count: 5 }) })), isError && (_jsx(ErrorState, { title: "Kategori gagal dimuat", message: "Periksa koneksi lalu coba lagi.", action: _jsx(Button, { onClick: () => refetch(), children: "Coba lagi" }) })), !isLoading && !isError && rows.length === 0 && (_jsx(EmptyState, { title: "Belum ada kategori", description: "Tambahkan kategori pertama sebelum membuat produk.", action: _jsx(Button, { onClick: openCreate, children: "Tambah kategori" }) })), !isLoading && !isError && rows.length > 0 && (_jsx("div", { className: "bg-white rounded-lg border border-gray-200 overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm text-left", children: [_jsx("thead", { className: "bg-gray-50 text-gray-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Nama" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Slug" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Urutan" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Produk" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Status" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Aksi" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: rows.map(({ category, depth }) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { style: { paddingLeft: depth * 20 }, children: [_jsxs("span", { className: "font-medium text-gray-900", children: [depth > 0 && _jsx("span", { className: "text-gray-400 mr-1", children: "\u2514" }), category.name] }), category.parent_id && (_jsxs("span", { className: "block text-xs text-gray-500", children: ["di dalam ", parentName(category.parent_id)] }))] }) }), _jsx("td", { className: "px-4 py-3 text-gray-600", children: category.slug }), _jsx("td", { className: "px-4 py-3 text-gray-600", children: category.sort_order }), _jsx("td", { className: "px-4 py-3 text-gray-600", children: category.product_count }), _jsx("td", { className: "px-4 py-3", children: _jsx(Badge, { variant: category.is_active ? 'success' : 'default', children: category.is_active ? 'Aktif' : 'Nonaktif' }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => openEdit(category), children: "Ubah" }), _jsx(Button, { variant: "danger", size: "sm", onClick: () => {
                                                        setDeleteError('');
                                                        setDeleting(category);
                                                    }, children: "Hapus" })] }) })] }, category.id))) })] }) })), _jsx(Modal, { isOpen: isFormOpen, onClose: closeForm, title: editing ? 'Ubah kategori' : 'Tambah kategori', footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", onClick: closeForm, disabled: saving, children: "Batal" }), _jsx(Button, { type: "submit", form: "category-form", isLoading: saving, children: "Simpan" })] }), children: _jsxs("form", { id: "category-form", onSubmit: handleSubmit, noValidate: true, className: "space-y-4", children: [formError && (_jsx("div", { role: "alert", className: "rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700", children: formError })), _jsx(Input, { label: "Nama kategori", value: form.name, onChange: (e) => setField('name', e.target.value), error: fieldErrors.name, disabled: saving, autoFocus: true }), _jsx(Select, { label: "Kategori induk (kosongkan untuk kategori utama)", value: form.parent_id, onChange: (e) => setField('parent_id', e.target.value), options: parentOptions, error: fieldErrors.parent_id, disabled: saving }), _jsx(Input, { label: "Slug", value: form.slug, onChange: (e) => setField('slug', e.target.value), error: fieldErrors.slug, helperText: editing
                                ? 'Mengubah slug akan mengubah alamat URL kategori'
                                : 'Kosongkan untuk dibuat otomatis dari nama', disabled: saving }), _jsx(Input, { label: "Urutan tampil", type: "number", inputMode: "numeric", min: 0, value: form.sort_order, onChange: (e) => setField('sort_order', e.target.value), error: fieldErrors.sort_order, helperText: "Angka kecil tampil lebih dulu", disabled: saving }), _jsxs("label", { className: "inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer", children: [_jsx(Checkbox, { checked: form.is_active, onChange: (e) => setField('is_active', e.target.checked), disabled: saving }), "Aktif (tampil di toko)"] })] }) }), _jsxs(Modal, { isOpen: deleting !== null, onClose: () => !deleteBusy && setDeleting(null), title: "Hapus kategori", size: "sm", footer: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", onClick: () => setDeleting(null), disabled: deleteBusy, children: "Batal" }), _jsx(Button, { variant: "danger", onClick: handleDelete, isLoading: deleteBusy, children: "Hapus" })] }), children: [_jsxs("p", { className: "text-gray-700", children: ["Hapus kategori ", _jsx("strong", { children: deleting?.name }), "? Tindakan ini tidak bisa dibatalkan."] }), deleteError && (_jsx("div", { role: "alert", className: "mt-3 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700", children: deleteError }))] })] }));
}
//# sourceMappingURL=AdminCategories.js.map