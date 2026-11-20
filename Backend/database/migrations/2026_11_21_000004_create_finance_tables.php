<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Money rules from FinanceDashboard.tsx:
 *  - Receipts are never edited or deleted. A mistake becomes a payment_reversal
 *    that needs HOI approval and creates a NEW negative entry.
 *  - Only an approved (active) fee structure can generate invoices.
 *  - A mid-term change creates a new structure version.
 *  - A locked accounting period can only change with HOI approval.
 * Amounts are decimal(12,2) in KES.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fee_structures', function (Blueprint $t) {
            $t->id();
            $t->foreignId('grade_id')->constrained();
            $t->foreignId('term_id')->constrained();
            $t->unsignedSmallInteger('version')->default(1);
            $t->enum('status', ['draft', 'awaiting_approval', 'active', 'archived'])->default('draft')->index();
            $t->decimal('total', 12, 2)->default(0);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('approved_at')->nullable();
            $t->timestamps();
            $t->unique(['grade_id', 'term_id', 'version']);
        });

        Schema::create('fee_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('fee_structure_id')->constrained()->cascadeOnDelete();
            $t->string('name');                           // Tuition, Lunch programme ...
            $t->decimal('amount', 12, 2);
            $t->boolean('is_optional')->default(false);
            $t->unsignedTinyInteger('sort_order')->default(0);
            $t->timestamps();
        });

        Schema::create('invoices', function (Blueprint $t) {
            $t->id();
            $t->string('invoice_no')->unique();
            $t->foreignId('learner_id')->constrained();
            $t->foreignId('term_id')->constrained();
            $t->foreignId('fee_structure_id')->constrained();
            $t->decimal('total', 12, 2);
            $t->decimal('waived', 12, 2)->default(0);
            $t->decimal('paid', 12, 2)->default(0);       // maintained when payments post
            $t->decimal('balance', 12, 2);                 // total - waived - paid
            $t->enum('status', ['open', 'partial', 'paid', 'void'])->default('open')->index();
            $t->date('issued_on');
            $t->date('due_on');
            $t->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('voided_at')->nullable();
            $t->foreignId('voided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->string('void_reason')->nullable();
            $t->timestamps();
            $t->unique(['learner_id', 'term_id', 'fee_structure_id']);
            $t->index(['status', 'due_on']);              // overdue lists
        });

        Schema::create('invoice_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $t->foreignId('fee_item_id')->nullable()->constrained()->nullOnDelete();
            $t->string('name');
            $t->decimal('amount', 12, 2);
        });

        Schema::create('accounting_periods', function (Blueprint $t) {
            $t->id();
            $t->string('label');                           // November 2026
            $t->date('starts_on');
            $t->date('ends_on');
            $t->boolean('is_locked')->default(false);
            $t->timestamp('locked_at')->nullable();
            $t->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['starts_on', 'ends_on']);
        });

        Schema::create('bank_statement_imports', function (Blueprint $t) {
            $t->id();
            $t->foreignId('accounting_period_id')->constrained();
            $t->enum('source', ['bank', 'mpesa']);
            $t->string('file_path');
            $t->unsignedInteger('line_count')->default(0);
            $t->foreignId('uploaded_by')->constrained('users');
            $t->timestamps();
        });

        // Payments are append-only. Never update amount or delete; reverse instead.
        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->string('receipt_no')->unique();            // RC-20944
            $t->foreignId('learner_id')->constrained();
            $t->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('term_id')->constrained();
            $t->decimal('amount', 12, 2);                  // negative for reversal entries
            $t->enum('method', ['Cash', 'Bank deposit', 'Mobile money', 'M-Pesa', 'Bank transfer', 'Card']);
            $t->string('reference')->nullable()->index();  // M-Pesa code or bank slip
            $t->string('payer_phone', 20)->nullable();
            $t->enum('source', ['office', 'portal'])->default('office');
            $t->enum('status', ['pending', 'completed', 'failed', 'reversed'])->default('completed')->index();
            $t->string('gateway_request_id')->nullable()->index(); // M-Pesa CheckoutRequestID
            $t->foreignId('reverses_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $t->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete(); // null = learner portal
            $t->timestamp('paid_at');
            $t->timestamps();
            $t->index(['learner_id', 'term_id']);
        });

        Schema::create('bank_statement_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('bank_statement_import_id')->constrained()->cascadeOnDelete();
            $t->date('txn_date');
            $t->string('description')->nullable();
            $t->string('reference')->nullable()->index();
            $t->decimal('amount', 12, 2);
            $t->enum('status', ['unmatched', 'matched', 'ignored'])->default('unmatched')->index();
            $t->foreignId('matched_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('payment_reversals', function (Blueprint $t) {
            $t->id();
            $t->foreignId('payment_id')->constrained();
            $t->foreignId('requested_by')->constrained('users');
            $t->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $t->text('reason');
            $t->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->index();
            $t->foreignId('reversal_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $t->timestamp('decided_at')->nullable();
            $t->timestamps();
        });

        Schema::create('fee_waivers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('invoice_id')->constrained();
            $t->foreignId('learner_id')->constrained();
            $t->decimal('amount', 12, 2);
            $t->text('reason');                            // hardship, bursary, sibling discount
            $t->foreignId('requested_by')->constrained('users');
            $t->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $t->enum('status', ['pending', 'approved', 'rejected'])->default('pending')->index();
            $t->timestamp('decided_at')->nullable();
            $t->timestamps();
        });

        Schema::create('fee_reminders', function (Blueprint $t) {
            $t->id();
            $t->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $t->foreignId('guardian_id')->nullable()->constrained()->nullOnDelete();
            $t->enum('channel', ['sms', 'email', 'whatsapp'])->default('sms');
            $t->text('message');
            $t->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('sent_at');
            $t->timestamps();
        });

        Schema::create('fee_queries', function (Blueprint $t) {
            $t->id();
            $t->string('ticket_no')->unique();
            $t->foreignId('learner_id')->constrained();
            $t->foreignId('raised_by')->constrained('users');
            $t->enum('raised_by_role', ['PARENT', 'LEARNER']);
            $t->string('subject');
            $t->enum('status', ['open', 'with_hoi', 'resolved', 'closed'])->default('open')->index();
            $t->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('resolved_at')->nullable();
            $t->timestamps();
        });

        Schema::create('fee_query_messages', function (Blueprint $t) {
            $t->id();
            $t->foreignId('fee_query_id')->constrained()->cascadeOnDelete();
            $t->foreignId('user_id')->constrained();
            $t->text('body');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['fee_query_messages', 'fee_queries', 'fee_reminders', 'fee_waivers', 'payment_reversals',
                  'bank_statement_lines', 'payments', 'bank_statement_imports', 'accounting_periods',
                  'invoice_lines', 'invoices', 'fee_items', 'fee_structures'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};