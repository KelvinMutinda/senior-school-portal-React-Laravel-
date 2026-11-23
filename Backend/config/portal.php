<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default passwords
    |--------------------------------------------------------------------------
    | Used only when a teacher or learner is registered. The account is also
    | marked must_change_password, so the default never stays in use.
    | Set both in .env. There is no fallback on purpose.
    */
    'default_passwords' => [
        'learner' => env('LEARNER_DEFAULT_PASSWORD'),
        'teacher' => env('TEACHER_DEFAULT_PASSWORD'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Where the React app should send each role after sign-in
    |--------------------------------------------------------------------------
    | These match the routes in App.tsx.
    */
    'redirects' => [
        'learner'         => '/Learner/Dashboard',
        'teacher'         => '/Teacher/Dashboard',
        'hoi'             => '/Hoi/Dashboard',
        'deputy'          => '/Hoi/Dashboard', // deputy shares the HOI dashboard
        'finance'         => '/Finances/Dashboard',
        'change_password' => '/auth/ChangePassword', // not in App.tsx yet
    ],

    /*
    |--------------------------------------------------------------------------
    | Token lifetime
    |--------------------------------------------------------------------------
    | "Keep me signed in" on the login page uses remember_days.
    */
    'token' => [
        'hours'         => 8,
        'remember_days' => 30,
    ],

    /*
    |--------------------------------------------------------------------------
    | HOI account (inserted manually with HoiSeeder)
    |--------------------------------------------------------------------------
    | Fill these in .env, run the seeder once, then delete HOI_PASSWORD
    | from .env.
    */
    'hoi' => [
        'name'         => env('HOI_NAME', 'Head of Institution'),
        'staff_number' => env('HOI_STAFF_NUMBER'),
        'email'        => env('HOI_EMAIL'),
        'password'     => env('HOI_PASSWORD'),
    ],

];