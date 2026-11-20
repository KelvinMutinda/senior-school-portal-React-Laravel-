<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Deliberately NOT queued: queuing would serialize the temporary password into the jobs table.
 */
class TeacherAccountCreated extends Notification
{
    public function __construct(private string $temporaryPassword) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $loginUrl = rtrim(config('app.frontend_url', config('app.url')), '/') . '/login';

        return (new MailMessage)
            ->subject('Your Senior School Portal account')
            ->greeting("Hello {$notifiable->name},")
            ->line('A Teacher account has been created for you on the Senior School Portal.')
            ->line("Email: {$notifiable->email}")
            ->line("Temporary password: {$this->temporaryPassword}")
            ->action('Sign in', $loginUrl)
            ->line('You will be asked to choose a new password the first time you sign in.');
    }
}