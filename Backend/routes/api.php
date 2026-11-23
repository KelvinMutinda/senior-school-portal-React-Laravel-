<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\LearnerController;
use App\Http\Controllers\Api\TeacherController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Sign in
Route::post('/login', [LoginController::class, 'login']);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/learners', [LearnerController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    // Sign out
    Route::post('/logout', [LoginController::class, 'logout']);

    Route::post('/teachers', [TeacherController::class, 'store']);
});