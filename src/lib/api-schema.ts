import { z } from "zod";

const DecimalSchema = z.union([z.string(), z.number()]);

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
        details: z.unknown().optional()
      })
      .optional(),
    requestId: z.string().optional()
  })
  .passthrough();

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProductImageSchema = z.object({
  id: z.string(),
  productId: z.string(),
  url: z.string(),
  storageKey: z.string().nullable().optional(),
  provider: z.string(),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().nullable().optional(),
  sortOrder: z.number(),
  createdAt: z.string()
});

export const ProductVariantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  price: DecimalSchema,
  attributes: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProductCategorySchema = z.object({
  productId: z.string(),
  categoryId: z.string(),
  category: CategorySchema
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  basePrice: DecimalSchema,
  categories: z.array(ProductCategorySchema),
  variants: z.array(ProductVariantSchema),
  images: z.array(ProductImageSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ListResponseSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    items: z.array(schema),
    page: z.number().optional(),
    limit: z.number().optional(),
    total: z.number().optional()
  });

export const CartItemSchema = z.object({
  id: z.string(),
  cartId: z.string(),
  productId: z.string(),
  variantId: z.string().nullable().optional(),
  quantity: z.number(),
  priceSnapshot: DecimalSchema,
  nameSnapshot: z.string(),
  skuSnapshot: z.string(),
  attributesSnapshot: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const CartSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(CartItemSchema),
  updatedAt: z.string()
});

export const AddressSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  line1: z.string(),
  line2: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
  phone: z.string().nullable().optional(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const OrderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string().nullable().optional(),
  variantId: z.string().nullable().optional(),
  quantity: z.number(),
  priceSnapshot: DecimalSchema,
  nameSnapshot: z.string(),
  skuSnapshot: z.string(),
  attributesSnapshot: z.unknown()
});

export const PaymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  status: z.string(),
  amount: DecimalSchema,
  provider: z.string().nullable().optional(),
  externalRef: z.string().nullable().optional(),
  checkoutUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.string(),
  total: DecimalSchema,
  discountTotal: DecimalSchema.optional(),
  couponCode: z.string().nullable().optional(),
  currency: z.string(),
  paymentStatus: z.string(),
  items: z.array(OrderItemSchema).optional().default([]),
  payment: PaymentSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  role: z.string()
});

export const RoleSchema = z.object({
  id: z.string(),
  name: z.string()
});

export const PermissionSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string().nullable().optional()
});

export const CouponSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string().nullable().optional(),
  type: z.string(),
  value: DecimalSchema,
  minSubtotal: DecimalSchema.nullable().optional(),
  maxRedemptions: z.number().nullable().optional(),
  redemptionCount: z.number(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const RolePermissionSchema = z.object({
  roleId: z.string(),
  permissionId: z.string(),
  permission: PermissionSchema
});

export const RoleWithPermissionsSchema = RoleSchema.extend({
  permissions: z.array(RolePermissionSchema)
});

export const UserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional()
});

export const SupportReplySchema = z.object({
  id: z.string(),
  supportMessageId: z.string(),
  authorId: z.string(),
  message: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: UserSummarySchema.optional()
});

export const BrandingSchema = z.object({
  id: z.string(),
  key: z.string(),
  logoUrl: z.string().nullable().optional(),
  faviconUrl: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export const SupportMessageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  subject: z.string(),
  message: z.string(),
  status: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  user: UserSummarySchema.optional(),
  replies: z.array(SupportReplySchema).optional().default([])
});

export const NotificationPreferencesSchema = z.object({
  newProductNotificationsEnabled: z.boolean(),
  lastProductSeenAt: z.string().nullable().optional(),
  lastSupportSeenAt: z.string().nullable().optional()
});

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  roleId: z.string(),
  role: RoleSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const AuditLogSchema = z.object({
  id: z.string(),
  actorId: z.string().nullable().optional(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable().optional(),
  meta: z.unknown(),
  createdAt: z.string(),
  actor: UserSummarySchema.optional()
});

export const IdempotencyKeySchema = z.object({
  id: z.string(),
  key: z.string(),
  userId: z.string(),
  requestHash: z.string(),
  responseBody: z.unknown(),
  createdAt: z.string(),
  expiresAt: z.string()
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable().optional(),
    role: z.string()
  })
});

export const CheckoutSummarySchema = z.object({
  items: z.array(CartItemSchema),
  subtotal: DecimalSchema.optional(),
  discountTotal: DecimalSchema.optional(),
  total: DecimalSchema,
  couponCode: z.string().nullable().optional()
});

export const StockItemSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  onHand: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  variant: ProductVariantSchema.optional()
});

export const StockMovementSchema = z.object({
  id: z.string(),
  stockItemId: z.string(),
  delta: z.number(),
  reason: z.string(),
  createdAt: z.string()
});

export const StaffOrderSchema = OrderSchema.extend({
  user: UserSummarySchema.optional()
});

export const PaymentWithOrderSchema = PaymentSchema.extend({
  order: OrderSchema.optional()
});

export const AvailabilitySchema = z.object({
  inStock: z.boolean(),
  onHand: z.number()
});

export type Category = z.infer<typeof CategorySchema>;
export type ProductImage = z.infer<typeof ProductImageSchema>;
export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type ProductCategory = z.infer<typeof ProductCategorySchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type Coupon = z.infer<typeof CouponSchema>;
export type RolePermission = z.infer<typeof RolePermissionSchema>;
export type RoleWithPermissions = z.infer<typeof RoleWithPermissionsSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type SupportReply = z.infer<typeof SupportReplySchema>;
export type SupportMessage = z.infer<typeof SupportMessageSchema>;
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type Branding = z.infer<typeof BrandingSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type CheckoutSummary = z.infer<typeof CheckoutSummarySchema>;
export type StockItem = z.infer<typeof StockItemSchema>;
export type StockMovement = z.infer<typeof StockMovementSchema>;
export type StaffOrder = z.infer<typeof StaffOrderSchema>;
export type PaymentWithOrder = z.infer<typeof PaymentWithOrderSchema>;
export type Availability = z.infer<typeof AvailabilitySchema>;
