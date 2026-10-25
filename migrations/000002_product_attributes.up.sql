-- 000002_product_attributes.up.sql
-- Atribut yang dapat dipilih pelanggan untuk menentukan varian produk.

CREATE TABLE attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, name)
);

CREATE INDEX idx_attributes_product_id ON attributes(product_id);

CREATE TABLE attribute_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    value VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(attribute_id, value)
);

CREATE INDEX idx_attribute_options_attribute_id ON attribute_options(attribute_id);

CREATE TABLE variant_attribute_values (
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    attribute_option_id UUID NOT NULL REFERENCES attribute_options(id) ON DELETE CASCADE,
    PRIMARY KEY (variant_id, attribute_option_id)
);

CREATE INDEX idx_variant_attribute_values_option_id
    ON variant_attribute_values(attribute_option_id);
